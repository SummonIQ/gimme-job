import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const rendererUrl = 'http://127.0.0.1:5174';

await runCommand('bunx', ['tsc', '-p', 'tsconfig.electron.json']);

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
  const deadline = Date.now() + 15_000;

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
