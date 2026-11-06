// Test database (ADR-0003). TEST_DATABASE_URL points at a real PostGIS (CI, or Docker locally). Without it,
// PGlite with PostGIS runs in-process behind a socket. A separate variable from DATABASE_URL keeps tests,
// which truncate tables, away from a development database.
import { createServer } from 'node:net';
import type {} from 'vitest';
import { connect, migrate, type Sql } from './index.ts';

export interface TestDatabaseInfo {
  url: string;
  /** Pool size to use. PGlite has a single backend, so it's 1 there. */
  max: number;
  kind: 'postgres' | 'pglite';
}

export interface TestDatabase extends TestDatabaseInfo {
  stop(): Promise<void>;
}

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabase: TestDatabaseInfo;
  }
}

export async function startTestDatabase(env: NodeJS.ProcessEnv = process.env): Promise<TestDatabase> {
  const external = env.TEST_DATABASE_URL;
  if (external) {
    // Each Vitest run gets a database of its own on that server, dropped when it ends. `pnpm test` runs the
    // packages at the same time, and each test truncates every table, so sharing one database let one
    // package's tests empty another's mid-test (CI, 2026-11-06).
    const admin = connect(external, { max: 1, applicationName: 'nyc-nj-parking-test-admin' });
    const name = `${new URL(external).pathname.slice(1) || 'parking_test'}_${process.pid}_${Date.now()}`.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    try {
      await admin.unsafe(`create database "${name}"`);
    } finally {
      await admin.end();
    }
    const url = new URL(external);
    url.pathname = `/${name}`;
    await migrateDatabase(url.href);
    return {
      url: url.href,
      max: 4,
      kind: 'postgres',
      stop: async () => {
        const dropper = connect(external, { max: 1, applicationName: 'nyc-nj-parking-test-admin' });
        try {
          await dropper.unsafe(`drop database if exists "${name}" with (force)`);
        } finally {
          await dropper.end();
        }
      },
    };
  }

  const [{ PGlite }, { postgis }, { PGLiteSocketServer }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('@electric-sql/pglite-postgis'),
    import('@electric-sql/pglite-socket'),
  ]);
  const db = await PGlite.create({ extensions: { postgis } });
  const port = await freePort();
  const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 8 });
  await server.start();
  const url = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
  await migrateDatabase(url);
  return {
    url,
    max: 1,
    kind: 'pglite',
    stop: async () => {
      await server.stop();
      await db.close();
    },
  };
}

export function connectTest(info: TestDatabaseInfo): Sql {
  return connect(info.url, { max: info.max, applicationName: 'nyc-nj-parking-test' });
}

/** Empties every data table. Tests call it in beforeEach. */
export async function resetData(sql: Sql): Promise<void> {
  await sql`
    truncate facility_rate, facility_hours, facility_meter_period, facility_source, facility, source_record,
      ingestion_run, source_snapshot, source restart identity cascade`;
}

async function migrateDatabase(url: string): Promise<void> {
  const sql = connect(url, { max: 1, applicationName: 'nyc-nj-parking-test-migrate' });
  try {
    await migrate(sql);
  } finally {
    await sql.end();
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => (typeof address === 'object' && address ? resolve(address.port) : reject(new Error('No port'))));
    });
  });
}
