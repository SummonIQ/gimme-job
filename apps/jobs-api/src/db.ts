import pg, { type QueryResultRow } from 'pg';
import { performance } from 'node:perf_hooks';
import { config } from './config.js';

const { Pool } = pg;

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

export const pool = new Pool({
  connectionString: config.databaseUrl,
  connectionTimeoutMillis: config.connectionTimeoutMillis,
  idleTimeoutMillis: config.idleTimeoutMillis,
  max: config.databasePoolMax,
  ssl: config.databaseUrl.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined,
});

pool.on('error', error => {
  console.error('[jobs-api] postgres pool error', error);
});

export interface TimedQueryResult<T extends QueryResultRow> {
  durationMs: number;
  rowCount: number;
  rows: T[];
}

export const runQuery = async <T extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<TimedQueryResult<T>> => {
  const startedAt = performance.now();
  const result = await pool.query<T>(text, [...values]);
  return {
    durationMs: Math.round(performance.now() - startedAt),
    rowCount: result.rowCount ?? result.rows.length,
    rows: result.rows,
  };
};

export const pingDatabase = async (): Promise<number> => {
  const startedAt = performance.now();
  await pool.query('select 1');
  return Math.round(performance.now() - startedAt);
};
