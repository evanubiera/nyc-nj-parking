// Local development database without Docker (ADR-0010): PGlite with PostGIS, kept in a folder so the data
// survives restarts, behind a PostgreSQL socket on the usual port. Never used outside `pnpm dev`; tests use
// testing.ts, and CI and deployment use real PostgreSQL.
import { mkdir } from 'node:fs/promises';

export interface DevDatabase {
  stop(): Promise<void>;
}

export async function startDevDatabase({ port, dataDir }: { port: number; dataDir: string }): Promise<DevDatabase> {
  await mkdir(dataDir, { recursive: true });
  const [{ PGlite }, { postgis }, { PGLiteSocketServer }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('@electric-sql/pglite-postgis'),
    import('@electric-sql/pglite-socket'),
  ]);
  const db = await PGlite.create({ dataDir, extensions: { postgis } });
  const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 16 });
  await server.start();
  return {
    stop: async () => {
      await server.stop();
      await db.close();
    },
  };
}
