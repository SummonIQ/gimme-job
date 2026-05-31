import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webUrl = 'http://localhost:10100';
const webPort = 10100;
const realtimePort = Number(
  process.env.NEXT_PUBLIC_SUMMONFLOW_WS_PORT ?? '30221',
);
const realtimeServerEntry = path.resolve(
  rootDir,
  '..',
  'packages/summon-stream-demo-railway/dist/index.cjs',
);
const hasRealtimeServer = existsSync(realtimeServerEntry);

await killStaleDevProcesses({ port: webPort, repoRoot: rootDir });
if (hasRealtimeServer) {
  await killStaleDevProcesses({ port: realtimePort, repoRoot: rootDir });
}

const realtimeProcess: ChildProcess | null = hasRealtimeServer
  ? spawnCommand('node', [realtimeServerEntry], {
      cwd: rootDir,
      extraEnv: {
        PORT: String(realtimePort),
        SUMMON_STREAM_APP_KEY:
          process.env.SUMMONFLOW_APP_KEY ??
          process.env.NEXT_PUBLIC_SUMMONFLOW_APP_KEY ??
          '',
        SUMMON_STREAM_APP_SECRET: process.env.SUMMONFLOW_APP_SECRET ?? '',
        SUMMON_STREAM_PUBLISH_TOKEN:
          process.env.SUMMONFLOW_PUBLISH_TOKEN ?? '',
      },
    })
  : null;

if (!hasRealtimeServer) {
  console.log(
    `[dev] skipping realtime server — ${path.relative(rootDir, realtimeServerEntry)} not found. The plan board will show "Realtime unavailable".`,
  );
}

if (realtimeProcess) {
  await waitForTcp(realtimePort, realtimeProcess);
}

const webProcess = spawnCommand('bun', ['run', 'dev:web'], {
  cwd: rootDir,
});

await waitForHttp(webUrl, webProcess);

const desktopProcess = spawnCommand(
  'bun',
  ['run', 'desktop:dev'],
  {
    cwd: rootDir,
    extraEnv: {
      GIMME_JOB_APP_URL: webUrl,
      VITE_GIMME_JOB_APP_URL: webUrl,
    },
  },
);

let shuttingDown = false;
let shutdownPromise: Promise<void> | null = null;

const shutdown = async (signal: NodeJS.Signals) => {
  if (shuttingDown) {
    return shutdownPromise ?? Promise.resolve();
  }

  shuttingDown = true;
  shutdownPromise = (async () => {
    stopProcessTree(desktopProcess, signal);
    stopProcessTree(webProcess, signal);
    if (realtimeProcess) stopProcessTree(realtimeProcess, signal);

    const timeout = sleep(3_000).then(() => {
      forceStopProcessTree(desktopProcess);
      forceStopProcessTree(webProcess);
      if (realtimeProcess) forceStopProcessTree(realtimeProcess);
    });

    await Promise.allSettled([
      waitForProcessExit(desktopProcess),
      waitForProcessExit(webProcess),
      ...(realtimeProcess ? [waitForProcessExit(realtimeProcess)] : []),
      timeout,
    ]);
  })();

  return shutdownPromise;
};

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

const exitCode = await waitForExit(
  ...[webProcess, desktopProcess, realtimeProcess].filter(
    (p): p is ChildProcess => p !== null,
  ),
);
await shutdown('SIGTERM');
process.exit(exitCode);

function spawnCommand(
  command: string,
  args: string[],
  options: {
    cwd: string;
    extraEnv?: Record<string, string>;
  },
) {
  return spawn(command, args, {
    cwd: options.cwd,
    detached: true,
    env: {
      ...process.env,
      ...options.extraEnv,
    },
    stdio: 'inherit',
  });
}

function stopProcessTree(
  childProcess: ChildProcess,
  signal: NodeJS.Signals,
) {
  if (!childProcess.pid) {
    return;
  }

  try {
    process.kill(-childProcess.pid, signal);
  } catch {
    try {
      childProcess.kill(signal);
    } catch {
      // Ignore already-exited child groups.
    }
  }
}

function forceStopProcessTree(childProcess: ChildProcess) {
  if (!childProcess.pid) {
    return;
  }

  try {
    process.kill(-childProcess.pid, 'SIGKILL');
  } catch {
    try {
      childProcess.kill('SIGKILL');
    } catch {
      // Ignore already-exited child groups.
    }
  }
}

async function waitForTcp(port: number, childProcess: ChildProcess) {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    if (childProcess.exitCode !== null) {
      throw new Error(`Realtime server exited before binding port ${port}`);
    }

    const ok = await new Promise<boolean>(resolve => {
      const socket = createConnection({ host: '127.0.0.1', port }, () => {
        socket.end();
        resolve(true);
      });
      socket.once('error', () => resolve(false));
    });

    if (ok) return;

    await sleep(150);
  }

  throw new Error(`Realtime server did not become ready on port ${port}`);
}

async function waitForHttp(url: string, childProcess: ChildProcess) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (childProcess.exitCode !== null) {
      throw new Error(`Web app exited before becoming ready at ${url}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the dev server answers or exits.
    }

    await sleep(250);
  }

  throw new Error(`Web app did not become ready at ${url}`);
}

async function waitForExit(...processes: ChildProcess[]) {
  return await new Promise<number>(resolve => {
    for (const childProcess of processes) {
      childProcess.once('exit', code => resolve(code ?? 0));
    }
  });
}

async function waitForProcessExit(childProcess: ChildProcess) {
  if (childProcess.exitCode !== null || childProcess.signalCode !== null) {
    return;
  }

  await new Promise<void>(resolve => {
    childProcess.once('exit', () => resolve());
  });
}

function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

// Kill stale dev processes from a previous `bun dev` run. We only target
// processes that belong to THIS repo (next dev/electron paths under
// `repoRoot`) plus whatever is currently bound to the dev port. This avoids
// the broad `pkill node` shotgun that would also stop the user's other apps.
async function killStaleDevProcesses(input: {
  readonly port: number;
  readonly repoRoot: string;
}): Promise<void> {
  const pids = new Set<number>();

  for (const pid of pidsBoundToPort(input.port)) {
    pids.add(pid);
  }
  for (const pid of pidsMatchingCommand(`${input.repoRoot}/node_modules/.bin/next`)) {
    pids.add(pid);
  }
  for (const pid of pidsMatchingCommand(`${input.repoRoot}/desktop/dist-electron`)) {
    pids.add(pid);
  }
  // Detect the bun runner from a previous dev invocation (in case the parent
  // exited without cleaning up).
  for (const pid of pidsMatchingCommand(`${input.repoRoot}/scripts/dev.ts`)) {
    if (pid !== process.pid) pids.add(pid);
  }

  if (pids.size === 0) return;

  for (const pid of pids) {
    safeKill(pid, 'SIGTERM');
  }

  await sleep(500);

  const survivors = [...pids].filter(pid => isAlive(pid));
  for (const pid of survivors) {
    safeKill(pid, 'SIGKILL');
  }

  if (pids.size > 0) {
    console.log(
      `[dev] cleaned up ${pids.size} stale process${pids.size === 1 ? '' : 'es'} from a prior run.`,
    );
  }
}

function pidsBoundToPort(port: number): number[] {
  const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
    encoding: 'utf8',
  });
  if (result.status !== 0 || !result.stdout) return [];
  return result.stdout
    .split(/\s+/)
    .map(value => Number.parseInt(value, 10))
    .filter(value => Number.isFinite(value) && value > 0);
}

function pidsMatchingCommand(needle: string): number[] {
  const result = spawnSync('pgrep', ['-f', needle], { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout) return [];
  return result.stdout
    .split(/\s+/)
    .map(value => Number.parseInt(value, 10))
    .filter(value => Number.isFinite(value) && value > 0);
}

function safeKill(pid: number, signal: NodeJS.Signals) {
  try {
    process.kill(pid, signal);
  } catch {
    // Process may have already exited.
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
