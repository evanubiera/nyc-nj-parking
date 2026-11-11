// `pnpm rebuild`: rebuilds the facility tables from the stored source records, without fetching anything. For a change
// to how facilities are built, such as their areas (ADR-0021), to reach them before a source's data changes (ING-7).
import { connect } from '@parking/db';
import { configFromEnv } from './config.ts';
import { rebuildFacilities } from './facilities/apply.ts';

const { databaseUrl, logger } = configFromEnv();
const sql = connect(databaseUrl, { max: 1, applicationName: 'nyc-nj-parking-rebuild' });
try {
  const counts = await sql.begin((tx) => rebuildFacilities(tx, new Date()));
  logger.info({ ...counts }, 'facilities rebuilt');
  console.log(JSON.stringify(counts));
} finally {
  await sql.end();
}
