import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var cachedDb: PrismaClient;
}

let db: PrismaClient;

function createPrismaClient() {
  let connectionString = process.env.DATABASE_URL;
  const usesSsl = connectionString?.includes('sslmode=');

  // Replace weak sslmode values with verify-full to silence pg deprecation
  // warning while keeping the same actual behaviour (rejectUnauthorized: true).
  if (connectionString && usesSsl) {
    connectionString = connectionString.replace(
      /sslmode=(prefer|require|verify-ca)/,
      'sslmode=verify-full',
    );
  }

  const adapter = new PrismaPg({
    connectionString,
    ...(usesSsl && {
      ssl: { rejectUnauthorized: true },
    }),
  });
  return new PrismaClient({ adapter });
}

if (process.env.NODE_ENV === 'production') {
  db = createPrismaClient();
} else {
  if (!(global as any).cachedDb) {
    (global as any).cachedDb = createPrismaClient();
  }
  db = (global as any).cachedDb;
}

export { db };
