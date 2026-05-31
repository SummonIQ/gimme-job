import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';

interface CliOptions {
  appName: string;
  forceTls?: boolean;
  json: boolean;
  organizationName: string;
  ownerEmail: string;
  ownerName: string;
  publishToken?: string;
  realtimeOrigin: string;
  summonflowDir: string;
  writeEnv: boolean;
  wsHost?: string;
  wsPort?: string;
}

interface EnvBlock {
  NEXT_PUBLIC_SUMMONFLOW_APP_KEY: string;
  NEXT_PUBLIC_SUMMONFLOW_FORCE_TLS: string;
  NEXT_PUBLIC_SUMMONFLOW_WS_HOST: string;
  NEXT_PUBLIC_SUMMONFLOW_WS_PORT: string;
  SUMMONFLOW_APP_KEY: string;
  SUMMONFLOW_APP_SECRET: string;
  SUMMONFLOW_HTTP_ORIGIN: string;
  SUMMONFLOW_PUBLISH_TOKEN: string;
}

interface SummonFlowApp {
  id: string;
  key: string;
  name: string;
  secret: string;
}

const DEFAULT_APP_NAME = 'Gimme Job Plan Board';
const DEFAULT_ORGANIZATION_NAME = 'Gimme Job';
const DEFAULT_OWNER_EMAIL = 'agents@gimme-job.local';
const DEFAULT_OWNER_NAME = 'Gimme Job Agents';
const DEFAULT_REALTIME_ORIGIN = 'https://realtime.summonflow.com';
const PLAN_BOARD_CHANNEL = 'public-gimme-job-plan-board';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const parseArgs = (argv: readonly string[]): CliOptions => {
  const options: CliOptions = {
    appName: DEFAULT_APP_NAME,
    json: false,
    organizationName: DEFAULT_ORGANIZATION_NAME,
    ownerEmail: DEFAULT_OWNER_EMAIL,
    ownerName: DEFAULT_OWNER_NAME,
    realtimeOrigin: DEFAULT_REALTIME_ORIGIN,
    summonflowDir: process.env.SUMMONFLOW_DIR ?? path.join(homedir(), 'Projects', 'summonflow'),
    writeEnv: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--json') {
      options.json = true;
      continue;
    }

    if (arg === '--write-env') {
      options.writeEnv = true;
      continue;
    }

    if (arg === '--force-tls') {
      options.forceTls = true;
      continue;
    }

    if (arg === '--no-force-tls') {
      options.forceTls = false;
      continue;
    }

    if (!next) {
      throw new Error(`Missing value for ${arg}`);
    }

    if (arg === '--app-name') {
      options.appName = next;
      index += 1;
      continue;
    }

    if (arg === '--organization-name') {
      options.organizationName = next;
      index += 1;
      continue;
    }

    if (arg === '--owner-email') {
      options.ownerEmail = next;
      index += 1;
      continue;
    }

    if (arg === '--owner-name') {
      options.ownerName = next;
      index += 1;
      continue;
    }

    if (arg === '--publish-token') {
      options.publishToken = next;
      index += 1;
      continue;
    }

    if (arg === '--realtime-origin') {
      options.realtimeOrigin = next;
      index += 1;
      continue;
    }

    if (arg === '--summonflow-dir') {
      options.summonflowDir = resolveHome(next);
      index += 1;
      continue;
    }

    if (arg === '--ws-host') {
      options.wsHost = next;
      index += 1;
      continue;
    }

    if (arg === '--ws-port') {
      options.wsPort = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  options.summonflowDir = resolveHome(options.summonflowDir);
  return options;
};

const printHelp = (): void => {
  console.log(`Provision a SummonFlow app for the Gimme Job admin plan board.

Usage:
  bun scripts/setup-summonflow-app.ts [options]

Options:
  --app-name <name>             SummonFlow app name. Default: "${DEFAULT_APP_NAME}"
  --organization-name <name>    Organization name if one must be created. Default: "${DEFAULT_ORGANIZATION_NAME}"
  --owner-email <email>         Owner user email if one must be created. Default: ${DEFAULT_OWNER_EMAIL}
  --owner-name <name>           Owner user display name. Default: "${DEFAULT_OWNER_NAME}"
  --summonflow-dir <path>       Local SummonFlow control-plane repo. Default: ~/Projects/summonflow
  --realtime-origin <url>       Publish HTTP origin. Default: ${DEFAULT_REALTIME_ORIGIN}
  --ws-host <host>              Browser WebSocket host. Default: derived from --realtime-origin
  --ws-port <port>              Browser WebSocket port. Default: derived from --realtime-origin
  --force-tls / --no-force-tls  Browser TLS flag. Default: derived from --realtime-origin
  --publish-token <token>       Publish token to print. Default: app secret for local/dev use
  --write-env                   Update this repo's .env.local with the generated values
  --json                        Print machine-readable JSON
`);
};

const resolveHome = (value: string): string => {
  if (value === '~') return homedir();
  if (value.startsWith('~/')) return path.join(homedir(), value.slice(2));
  return path.resolve(value);
};

const loadEnvFile = (filePath: string): Record<string, string> => {
  if (!existsSync(filePath)) return {};

  const env: Record<string, string> = {};
  for (const rawLine of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = /^([\w.-]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;

    const [, key, rawValue] = match;
    env[key] = unquoteEnvValue(rawValue);
  }

  return env;
};

const unquoteEnvValue = (rawValue: string): string => {
  const trimmed = rawValue.trim();
  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
};

const loadSummonFlowEnv = (summonflowDir: string): Record<string, string> => ({
  ...loadEnvFile(path.join(summonflowDir, '.env')),
  ...loadEnvFile(path.join(summonflowDir, '.env.local')),
});

const normalizePgConnectionString = (databaseUrl: string): string => {
  const url = new URL(databaseUrl);
  const sslMode = url.searchParams.get('sslmode');
  if (sslMode && ['prefer', 'require', 'verify-ca'].includes(sslMode)) {
    url.searchParams.set('sslmode', 'verify-full');
  }

  return url.toString();
};

const createId = (prefix: string): string => `${prefix}_${randomBytes(12).toString('base64url')}`;

const createAppKey = (name: string): string => {
  const slug = slugify(name);
  return `${slug}-${randomBytes(6).toString('hex')}`;
};

const createSecret = (): string => `sfsec_${randomBytes(32).toString('base64url')}`;

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'workspace';

const splitName = (ownerName: string): { firstName: string; lastName: string } => {
  const parts = ownerName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? 'Gimme',
    lastName: parts.slice(1).join(' ') || 'Job',
  };
};

const reserveOrganizationSlug = async (db: Client, organizationName: string): Promise<string> => {
  const base = slugify(organizationName);

  for (let index = 0; index < 10; index += 1) {
    const slug = index === 0 ? base : `${base}-${index + 1}`;
    const result = await db.query('select id from organization where slug = $1 limit 1', [slug]);
    if (result.rowCount === 0) return slug;
  }

  return `${base}-${Date.now().toString(36)}`;
};

const ensureOwner = async (
  db: Client,
  options: Pick<CliOptions, 'ownerEmail' | 'ownerName'>,
): Promise<{ id: string }> => {
  const existing = await db.query<{ id: string }>('select id from "user" where email = $1 limit 1', [
    options.ownerEmail,
  ]);

  if (existing.rows[0]) return existing.rows[0];

  const { firstName, lastName } = splitName(options.ownerName);
  const id = createId('usr');

  await db.query(
    `insert into "user" (
      id,
      email,
      "emailVerified",
      "firstName",
      "lastName",
      name,
      "createdAt",
      "updatedAt"
    ) values ($1, $2, true, $3, $4, $5, now(), now())`,
    [id, options.ownerEmail, firstName, lastName, options.ownerName],
  );

  return { id };
};

const ensureOrganization = async (
  db: Client,
  organizationName: string,
): Promise<{ id: string; name: string }> => {
  const existing = await db.query<{ id: string; name: string }>(
    'select id, name from organization where name = $1 order by "createdAt" asc limit 1',
    [organizationName],
  );

  if (existing.rows[0]) return existing.rows[0];

  const id = createId('org');
  const slug = await reserveOrganizationSlug(db, organizationName);

  await db.query(
    'insert into organization (id, name, slug, "createdAt") values ($1, $2, $3, now())',
    [id, organizationName, slug],
  );

  return { id, name: organizationName };
};

const ensureMember = async (
  db: Client,
  input: { organizationId: string; userId: string },
): Promise<void> => {
  const existing = await db.query(
    'select id from member where "userId" = $1 and "organizationId" = $2 limit 1',
    [input.userId, input.organizationId],
  );

  if (existing.rowCount && existing.rowCount > 0) return;

  await db.query(
    'insert into member (id, "userId", "organizationId", role, "createdAt") values ($1, $2, $3, $4, now())',
    [createId('mbr'), input.userId, input.organizationId, 'owner'],
  );
};

const ensureApp = async (
  db: Client,
  input: { appName: string; organizationId: string; userId: string },
): Promise<SummonFlowApp> => {
  const existing = await db.query<SummonFlowApp>(
    'select id, name, key, secret from "App" where name = $1 and "organizationId" = $2 limit 1',
    [input.appName, input.organizationId],
  );

  if (existing.rows[0]) return existing.rows[0];

  const app: SummonFlowApp = {
    id: createId('app'),
    key: createAppKey(input.appName),
    name: input.appName,
    secret: createSecret(),
  };

  await db.query(
    `insert into "App" (
      id,
      name,
      key,
      secret,
      "createdAt",
      "updatedAt",
      "userId",
      "organizationId"
    ) values ($1, $2, $3, $4, now(), now(), $5, $6)`,
    [app.id, app.name, app.key, app.secret, input.userId, input.organizationId],
  );

  return app;
};

const ensurePublicChannelPolicy = async (db: Client, appId: string): Promise<void> => {
  const pattern = PLAN_BOARD_CHANNEL;
  const existing = await db.query(
    'select id from "ChannelPolicy" where "appId" = $1 and pattern = $2 limit 1',
    [appId, pattern],
  );

  if (existing.rowCount && existing.rowCount > 0) return;

  await db.query(
    'insert into "ChannelPolicy" (id, "appId", pattern, type, "createdAt", "updatedAt") values ($1, $2, $3, $4, now(), now())',
    [createId('pol'), appId, pattern, 'PUBLIC'],
  );
};

const envFromApp = (app: SummonFlowApp, options: CliOptions): EnvBlock => {
  const realtimeUrl = new URL(options.realtimeOrigin);
  const forceTls = options.forceTls ?? (realtimeUrl.protocol === 'https:');
  const wsHost = options.wsHost ?? realtimeUrl.hostname;
  const wsPort = options.wsPort ?? (realtimeUrl.port || (forceTls ? '443' : '80'));
  const publishToken = options.publishToken ?? app.secret;

  return {
    NEXT_PUBLIC_SUMMONFLOW_APP_KEY: app.key,
    NEXT_PUBLIC_SUMMONFLOW_FORCE_TLS: String(forceTls),
    NEXT_PUBLIC_SUMMONFLOW_WS_HOST: wsHost,
    NEXT_PUBLIC_SUMMONFLOW_WS_PORT: wsPort,
    SUMMONFLOW_APP_KEY: app.key,
    SUMMONFLOW_APP_SECRET: app.secret,
    SUMMONFLOW_HTTP_ORIGIN: options.realtimeOrigin,
    SUMMONFLOW_PUBLISH_TOKEN: publishToken,
  };
};

const formatEnvBlock = (env: EnvBlock): string =>
  Object.entries(env)
    .map(([key, value]) => `${key}=${quoteEnvValue(value)}`)
    .join('\n');

const quoteEnvValue = (value: string): string => {
  if (/^[A-Za-z0-9_./:@-]+$/.test(value)) return value;
  return JSON.stringify(value);
};

const writeEnvFile = (filePath: string, values: EnvBlock): void => {
  const previous = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  const managedKeys = new Set(Object.keys(values));
  const retainedLines = previous
    .split(/\r?\n/)
    .filter(line => {
      const match = /^([\w.-]+)\s*=/.exec(line.trim());
      return !match || !managedKeys.has(match[1]);
    })
    .filter((line, index, lines) => line.trim() || index < lines.length - 1);

  const nextContent = [
    ...retainedLines,
    retainedLines.length > 0 && retainedLines.at(-1)?.trim() ? '' : undefined,
    '# SummonFlow plan-board realtime',
    formatEnvBlock(values),
  ]
    .filter((line): line is string => typeof line === 'string')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');

  writeFileSync(filePath, `${nextContent.trimEnd()}\n`);
};

const fingerprint = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 12);

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!existsSync(options.summonflowDir)) {
    throw new Error(`SummonFlow directory not found: ${options.summonflowDir}`);
  }

  const summonflowEnv = loadSummonFlowEnv(options.summonflowDir);
  const databaseUrl = summonflowEnv.DATABASE_URL ?? process.env.SUMMONFLOW_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      `Missing DATABASE_URL. Add it to ${path.join(options.summonflowDir, '.env.local')} or set SUMMONFLOW_DATABASE_URL.`,
    );
  }

  const usesLocalDatabase = /\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(databaseUrl);
  const disablesSsl = /[?&]sslmode=disable\b/.test(databaseUrl);

  const db = new Client({
    connectionString: normalizePgConnectionString(databaseUrl),
    ssl: usesLocalDatabase || disablesSsl ? undefined : { rejectUnauthorized: true },
  });

  await db.connect();

  try {
    const owner = await ensureOwner(db, options);
    const organization = await ensureOrganization(db, options.organizationName);
    await ensureMember(db, { organizationId: organization.id, userId: owner.id });

    const app = await ensureApp(db, {
      appName: options.appName,
      organizationId: organization.id,
      userId: owner.id,
    });
    await ensurePublicChannelPolicy(db, app.id);

    const env = envFromApp(app, options);

    if (options.writeEnv) {
      writeEnvFile(path.join(repoRoot, '.env.local'), env);
    }

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            app,
            channel: PLAN_BOARD_CHANNEL,
            env,
            organization,
            wroteEnv: options.writeEnv,
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(`SummonFlow app ready: ${app.name}`);
    console.log(`Organization: ${organization.name}`);
    console.log(`Channel policy: ${PLAN_BOARD_CHANNEL}`);
    console.log(`App key: ${app.key}`);
    console.log(`App secret fingerprint: ${fingerprint(app.secret)}`);
    console.log('');
    console.log(formatEnvBlock(env));

    if (options.writeEnv) {
      console.log('');
      console.log(`Updated ${path.join(repoRoot, '.env.local')}`);
    }
  } finally {
    await db.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
