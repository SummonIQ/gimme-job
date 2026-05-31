import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const FIXTURE_FAMILIES = [
  'greenhouse',
  'lever',
  'ashby',
  'smartrecruiters',
] as const;

export type FixtureFamily = (typeof FIXTURE_FAMILIES)[number];

export interface FixtureManifest {
  family: FixtureFamily;
  role: string;
  company: string;
  submitPath: string;
  confirmationPhrase: string;
  confirmationPath: string;
  steps: Array<Record<string, unknown>>;
  fields: Record<string, Record<string, unknown>>;
  submitSelector: string;
}

export interface FixtureServerOptions {
  /**
   * Fixed latency added to every response in ms. Default 25ms approximates a
   * real ATS round-trip without making tests slow.
   */
  readonly latencyMs?: number;
  /**
   * Port to bind. `0` picks an ephemeral port (recommended for tests so
   * parallel suites don't collide). Default 0.
   */
  readonly port?: number;
  /**
   * Override the fixtures root. Default resolves to `<repo>/fixtures/ats`.
   */
  readonly fixturesRoot?: string;
}

export interface StartedFixtureServer {
  readonly port: number;
  readonly baseUrl: string;
  readonly server: Server;
  readonly stop: () => Promise<void>;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const FAMILY_SET = new Set<string>(FIXTURE_FAMILIES);

function defaultFixturesRoot(): string {
  return path.resolve(process.cwd(), 'fixtures/ats');
}

function resolveFamily(familyPart: string | undefined): FixtureFamily | null {
  if (!familyPart || !FAMILY_SET.has(familyPart)) return null;
  return familyPart as FixtureFamily;
}

async function readFixture(
  root: string,
  family: FixtureFamily,
  file: string,
): Promise<{ body: Buffer; mime: string } | null> {
  const target = path.resolve(root, family, file);
  const safe = target.startsWith(path.resolve(root, family) + path.sep);
  if (!safe) return null;
  try {
    const body = await readFile(target);
    const mime = MIME[path.extname(target)] ?? 'application/octet-stream';
    return { body, mime };
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
  latencyMs: number,
) {
  await sleep(latencyMs);

  if (!req.url) {
    res.statusCode = 400;
    res.end('missing url');
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const segments = url.pathname.split('/').filter(Boolean);

  if (segments[0] !== 'fixtures' || segments[1] !== 'ats' && segments[1] !== undefined) {
    // Accept both /fixtures/<family>/... and /fixtures/ats/<family>/... for ergonomics.
  }

  // Normalize: /fixtures/<family>/<file> and /fixtures/ats/<family>/<file>.
  let familyPart: string | undefined;
  let tail: string[];
  if (segments[0] === 'fixtures' && segments[1] === 'ats') {
    familyPart = segments[2];
    tail = segments.slice(3);
  } else if (segments[0] === 'fixtures') {
    familyPart = segments[1];
    tail = segments.slice(2);
  } else {
    res.statusCode = 404;
    res.end('not found');
    return;
  }

  const family = resolveFamily(familyPart);
  if (!family) {
    res.statusCode = 404;
    res.end(`unknown family: ${familyPart}`);
    return;
  }

  if (req.method === 'GET' && (tail.length === 0 || tail[0] === 'application' || tail[0] === 'application.html')) {
    const file = await readFixture(root, family, 'application.html');
    if (!file) {
      res.statusCode = 404;
      res.end('application.html missing');
      return;
    }
    res.statusCode = 200;
    res.setHeader('content-type', file.mime);
    res.end(file.body);
    return;
  }

  if (req.method === 'GET' && (tail[0] === 'confirmation' || tail[0] === 'confirmation.html')) {
    const file = await readFixture(root, family, 'confirmation.html');
    if (!file) {
      res.statusCode = 404;
      res.end('confirmation.html missing');
      return;
    }
    res.statusCode = 200;
    res.setHeader('content-type', file.mime);
    res.end(file.body);
    return;
  }

  if (req.method === 'GET' && tail[0] === 'fixture.json') {
    const file = await readFixture(root, family, 'fixture.json');
    if (!file) {
      res.statusCode = 404;
      res.end('fixture.json missing');
      return;
    }
    res.statusCode = 200;
    res.setHeader('content-type', file.mime);
    res.end(file.body);
    return;
  }

  if (req.method === 'POST' && tail[0] === 'submit') {
    // Drain the body (multipart or urlencoded). We do not persist it —
    // fixtures only need to round-trip a successful POST.
    let bytes = 0;
    for await (const chunk of req) {
      bytes += (chunk as Buffer).length;
    }
    const reference = `${family.toUpperCase()}-${Date.now()}`;
    const file = await readFixture(root, family, 'confirmation.html');
    const body =
      file?.body.toString('utf8').replace(
        '<span data-field="reference"></span>',
        `<span data-field="reference">${reference}</span>`,
      ) ?? '<h1>Application received</h1>';
    res.statusCode = 200;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('x-fixture-bytes-received', String(bytes));
    res.setHeader('x-fixture-reference', reference);
    res.end(body);
    return;
  }

  res.statusCode = 405;
  res.end('method not allowed');
}

export async function startFixtureServer(
  options: FixtureServerOptions = {},
): Promise<StartedFixtureServer> {
  const root = options.fixturesRoot ?? defaultFixturesRoot();
  const latencyMs = options.latencyMs ?? 25;
  const requestedPort = options.port ?? 0;

  const server = createServer((req, res) => {
    handle(req, res, root, latencyMs).catch(err => {
      res.statusCode = 500;
      res.end(`fixture-server error: ${err instanceof Error ? err.message : String(err)}`);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(requestedPort, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('fixture-server failed to bind');
  }

  const port = address.port;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    port,
    server,
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close(err => (err ? reject(err) : resolve()));
      }),
  };
}
