import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(__dirname, '../../../../packages/database/prisma/migrations');

export interface TestDatabase {
  url: string;
  kind: 'postgres' | 'pglite';
  close(): Promise<void>;
}

/**
 * Postgres thật cho integration test.
 * - `INTEGRATION_DATABASE_URL` đặt (CI): dùng DB đã chạy `prisma migrate deploy`.
 * - Không đặt (local): PGlite trong tiến trình, áp lần lượt mọi migration như Prisma.
 * Test không xóa dữ liệu (audit_logs là append-only); mỗi test dùng id/slug ngẫu nhiên.
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  const external = process.env.INTEGRATION_DATABASE_URL;
  if (external) {
    return { url: external, kind: 'postgres', close: async () => undefined };
  }

  // Extension contrib của PGlite chỉ có bản ESM; package API là CommonJS nên nạp động.
  const [{ citext }, { pg_trgm }, { unaccent }] = await Promise.all([
    import('@electric-sql/pglite/contrib/citext'),
    import('@electric-sql/pglite/contrib/pg_trgm'),
    import('@electric-sql/pglite/contrib/unaccent'),
  ]);
  const db = await PGlite.create({ extensions: { citext, pg_trgm, unaccent } });
  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d{14}_/.test(name))
    .sort();
  for (const name of migrations) {
    // Mỗi file là một lần exec riêng, giống ranh giới transaction của Prisma Migrate.
    await db.exec(readFileSync(join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8'));
  }

  const { server, port } = await listenOnFreePort(db);
  // pgbouncer=true: không dùng prepared statement có tên, tránh xung đột giữa các kết nối
  // vì PGlite chỉ có một session dùng chung.
  const url = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable&connection_limit=1&pgbouncer=true`;
  return {
    url,
    kind: 'pglite',
    close: async () => {
      await server.stop();
      await db.close();
    },
  };
}

async function listenOnFreePort(db: PGlite) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const port = 50_000 + Math.floor(Math.random() * 10_000);
    const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' });
    try {
      await server.start();
      return { server, port };
    } catch {
      // Cổng đang bận: thử cổng khác.
    }
  }
  throw new Error('Không tìm được cổng trống cho PGlite');
}
