import { connect, databaseUrlFromEnv } from '@parking/db';
import { buildApp } from './app.ts';

const sql = connect(databaseUrlFromEnv(), { applicationName: 'nyc-nj-parking-api', connectTimeoutSeconds: 2 });
const app = await buildApp({ sql, logger: { level: process.env.LOG_LEVEL ?? 'info' } });

let closing = false;
async function shutdown(): Promise<void> {
  if (closing) return;
  closing = true;
  await app.close();
  await sql.end({ timeout: 5 });
}
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());

await app.listen({ port: Number(process.env.PORT ?? 8180), host: process.env.HOST ?? '127.0.0.1' });
