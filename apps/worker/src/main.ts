// The scheduler: runs each admitted source on its cron schedule, in New York time, never overlapping itself.
import { connect } from '@parking/db';
import { Cron } from 'croner';
import { configFromEnv } from './config.ts';
import { runSource } from './run.ts';
import { sources } from './sources/registry.ts';

const { databaseUrl, http, logger } = configFromEnv();

if (sources.length === 0) {
  logger.warn('No admitted sources (specs/06-sources.md), so there is nothing to schedule');
  process.exit(0);
}

const sql = connect(databaseUrl, { applicationName: 'nyc-nj-parking-worker' });
const jobs = sources.map(
  (source) =>
    new Cron(source.schedule, { name: source.id, timezone: 'America/New_York', protect: true }, async () => {
      try {
        await runSource(source, { sql, http, logger });
      } catch (error) {
        // runSource records its own failures; this is the database being unreachable before a run starts.
        logger.error({ sourceId: source.id, errorName: error instanceof Error ? error.name : typeof error }, 'ingestion run not started');
      }
    }),
);
logger.info({ sources: sources.map((source) => source.id) }, 'scheduler started');

async function shutdown(): Promise<void> {
  for (const job of jobs) job.stop();
  await sql.end({ timeout: 10 });
}
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
