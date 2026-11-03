// `pnpm ingest <source-id>`: runs one admitted source once and prints the outcome.
import { connect } from '@parking/db';
import { configFromEnv } from './config.ts';
import { runSource } from './run.ts';
import { findSource, sources } from './sources/registry.ts';

const id = process.argv[2];
const source = id ? findSource(id) : undefined;
if (!source) {
  const known = sources.map((entry) => entry.id).join(', ') || 'none yet';
  console.error(`Usage: pnpm ingest <source-id>. Admitted sources: ${known}.`);
  process.exit(2);
}

const { databaseUrl, http, logger } = configFromEnv();
const sql = connect(databaseUrl, { max: 2, applicationName: 'nyc-nj-parking-ingest' });
try {
  const outcome = await runSource(source, { sql, http, logger });
  console.log(JSON.stringify(outcome));
  process.exitCode = outcome.status === 'failed' ? 1 : 0;
} finally {
  await sql.end();
}
