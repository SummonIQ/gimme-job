import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const RENDERER_PORT = 5174;
const rendererUrl = `http://127.0.0.1:${RENDERER_PORT}`;

await killExistingDesktopProcesses();
await runCommand('bunx', ['tsc', '-p', 'tsconfig.electron.json']);
// Bundle the in-repo scrape-service.ts into a single .mjs the Electron
// main process imports at runtime. Keeps scrape execution local so the
// desktop doesn't have to hit the web /api/admin/scrape endpoint.
await runCommand('bun', ['scripts/bundle-scrape.ts']);

const viteProcess = spawnCommand('bunx', [
  'vite',
  '--host',
  '127.0.0.1',
  '--port',
  '5174',
]);

await waitForRenderer();

const electronProcess = spawnCommand('bunx', ['electron', '.'], {
  VITE_DEV_SERVER_URL: rendererUrl,
});

const cleanup = () => {
  viteProcess.kill();
  electronProcess.kill();
};

process.once('SIGINT', cleanup);
process.once('SIGTERM', cleanup);

const exitCode = await new Promise<number>(resolve => {
  electronProcess.once('exit', code => resolve(code ?? 0));
});

cleanup();
process.exit(exitCode);

function spawnCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv = {},
) {
  return spawn(command, args, {
    cwd: desktopRoot,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
}

async function runCommand(command: string, args: string[]) {
  const childProcess = spawnCommand(command, args);
  const exitCode = await new Promise<number>(resolve => {
    childProcess.once('exit', code => resolve(code ?? 0));
  });

  if (exitCode !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with ${exitCode}`);
  }
}

async function waitForRenderer() {
  // 60s deadline accommodates Vite's first-run dep optimization, which can
  // take 20–40s after a config change before the dev server starts serving.
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(rendererUrl);
      if (response.ok) {
        return;
      }
    } catch {
      await sleep(250);
    }
  }

  throw new Error(`Renderer did not start at ${rendererUrl}`);
}

function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

// Preflight: free up port 5174 and kill any leftover Electron / Vite
// processes from a previous dev session. We match strictly on this
// project's desktop folder so we never touch unrelated Electron apps
// or Vite servers the user is running for other projects.
async function killExistingDesktopProcesses(): Promise<void> {
  const projectMarker = path.join(desktopRoot, 'node_modules');
  const victims = new Set<number>();

  // PIDs listening on the renderer port.
  const portResult = spawnSync(
    'lsof',
    ['-tiTCP:' + RENDERER_PORT, '-sTCP:LISTEN'],
    { encoding: 'utf8' },
  );
  if (portResult.status === 0) {
    for (const line of portResult.stdout.split('\n')) {
      const pid = Number.parseInt(line.trim(), 10);
      if (Number.isFinite(pid) && pid !== process.pid) victims.add(pid);
    }
  }

  // Electron/Vite/tsc processes whose command line references this
  // project's node_modules — those can only belong to a prior run of
  // this very script.
  const psResult = spawnSync(
    'ps',
    ['-ax', '-o', 'pid=,command='],
    { encoding: 'utf8' },
  );
  if (psResult.status === 0) {
    for (const line of psResult.stdout.split('\n')) {
      const trimmed = line.trimStart();
      const match = trimmed.match(/^(\d+)\s+(.*)$/);
      if (!match) continue;
      const pid = Number.parseInt(match[1], 10);
      const command = match[2];
      if (!Number.isFinite(pid) || pid === process.pid) continue;
      if (command.includes(projectMarker)) victims.add(pid);
    }
  }

  if (victims.size === 0) return;

  console.log(
    `[dev] killing ${victims.size} stale desktop process(es): ${[...victims].join(', ')}`,
  );
  for (const pid of victims) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  }
  // Give the OS a moment to release the port + Application Support locks.
  await sleep(750);

  // Re-check: if anything is still listening, escalate to SIGKILL.
  const stillBound = spawnSync(
    'lsof',
    ['-tiTCP:' + RENDERER_PORT, '-sTCP:LISTEN'],
    { encoding: 'utf8' },
  );
  if (stillBound.status === 0 && stillBound.stdout.trim()) {
    for (const line of stillBound.stdout.split('\n')) {
      const pid = Number.parseInt(line.trim(), 10);
      if (!Number.isFinite(pid) || pid === process.pid) continue;
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        /* gone */
      }
    }
    await sleep(250);
  }
}
