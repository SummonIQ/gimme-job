const readInteger = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const readOptional = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
};

export interface ServiceConfig {
  connectionTimeoutMillis: number;
  databasePoolMax: number;
  databaseUrl: string | undefined;
  defaultLimit: number;
  hardMaxLimit: number;
  idleTimeoutMillis: number;
  port: number;
  rapidApiProxySecret: string | undefined;
  serviceName: string;
}

export const config: ServiceConfig = {
  connectionTimeoutMillis: readInteger('DATABASE_CONNECTION_TIMEOUT_MS', 5_000),
  databasePoolMax: readInteger('DATABASE_POOL_MAX', 10),
  databaseUrl: readOptional('DATABASE_URL'),
  defaultLimit: readInteger('DEFAULT_LIMIT', 25),
  hardMaxLimit: readInteger('HARD_MAX_LIMIT', 500),
  idleTimeoutMillis: readInteger('DATABASE_IDLE_TIMEOUT_MS', 30_000),
  port: readInteger('PORT', 3000),
  rapidApiProxySecret: readOptional('RAPIDAPI_PROXY_SECRET'),
  serviceName: process.env.SERVICE_NAME?.trim() || 'gimme-job-listings-api',
};
