// `pnpm dev` (specs/04, ADR-0010): a database, the migrations, NYC data on the first start, then the API and
// the web app. Uses Docker's PostGIS (compose.yaml) when Docker is running, and otherwise PGlite with PostGIS
// kept in .data/pglite. Set DEV_DATABASE=docker or DEV_DATABASE=pglite to choose.
import { spawn, spawnSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configFromEnv } from '../apps/worker/src/config.ts';
import { runSource } from '../apps/worker/src/run.ts';
import { sources } from '../apps/worker/src/sources/registry.ts';
import { fixtureHttp } from '../apps/worker/test/fixtures.ts';
import { startDevDatabase, type DevDatabase } from '../packages/db/src/dev-database.ts';
import { connect, migrate, type Sql } from '../packages/db/src/index.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const log = (message: string) => console.log(`[dev] ${message}`);

// The same default as .env.example, so a fresh clone works without copying it. The API inherits it.
process.env.DATABASE_URL ??= 'postgres://parking:parking@localhost:5434/parking';
const databaseUrl = new URL(process.env.DATABASE_URL);
const port = Number(databaseUrl.port || 5432);

let devDatabase: DevDatabase | null = null;

if (await portOpen(port)) {
  log(`Using the database already running on port ${port}.`);
} else if ((process.env.DEV_DATABASE ?? (dockerRunning() ? 'docker' : 'pglite')) === 'docker') {
  log('Starting PostGIS in Docker (compose.yaml)…');
  const result = spawnSync('docker', ['compose', 'up', '--detach', '--wait'], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error('docker compose up failed. Is Docker Desktop running?');
} else {
  const dataDir = join(root, '.data', 'pglite');
  log(`Docker isn't running, so using PGlite with PostGIS on port ${port}, saved in .data/pglite (ADR-0010).`);
  devDatabase = await startDevDatabase({ port, dataDir });
}

const sql = connect(databaseUrl.href, { max: 1, applicationName: 'nyc-nj-parking-dev' });
try {
  const applied = await migrate(sql);
  log(applied.length > 0 ? `Migrations applied: ${applied.join(', ')}` : 'Migrations: none pending');
  const [row] = await sql<{ count: number }[]>`select count(*)::int as count from facility where status = 'active'`;
  if (row!.count === 0) {
    await loadData(sql);
  } else {
    log(`${row!.count} facilities already loaded. To refresh them, run: pnpm ingest <source-id>`);
  }
} finally {
  await sql.end();
}

const apps = spawn(
  'pnpm',
  ['exec', 'concurrently', '--kill-others-on-fail', '--names', 'api,web', '--prefix-colors', 'blue,magenta',
    'pnpm --filter @parking/api dev', 'pnpm --filter @parking/web dev'],
  { cwd: root, stdio: 'inherit' },
);
log('Starting the API on http://localhost:8180 and the web app on http://localhost:5180 (Ctrl-C stops everything).');

let stopping = false;
async function stop(code: number): Promise<void> {
  if (stopping) return;
  stopping = true;
  if (apps.exitCode === null) apps.kill('SIGINT');
  await devDatabase?.stop();
  process.exit(code);
}
process.on('SIGINT', () => void stop(0));
process.on('SIGTERM', () => void stop(0));
apps.on('exit', (code) => void stop(code ?? 0));

/** The first start: each admitted source from NYC Open Data, or its saved copy if that can't be reached. */
async function loadData(sql: Sql): Promise<void> {
  const { http, logger } = configFromEnv();
  for (const source of sources) {
    log(`Loading ${source.id} from NYC Open Data…`);
    let outcome = await runSource(source, { sql, http, logger });
    if (outcome.status === 'failed') {
      log(`Couldn't load ${source.id} (${outcome.errorCode}). Loading its saved copy from 2026-11-03 instead.`);
      outcome = await runSource(source, { sql, http: fixtureHttp().http, logger });
    }
    log(`${source.id}: ${outcome.status}${outcome.counts ? `, ${outcome.counts.rowsWritten} records` : ''}`);
  }
}

function dockerRunning(): boolean {
  return spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
}

function portOpen(target: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port: target, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}
