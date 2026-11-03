// `pnpm db:migrate`: applies pending migrations to DATABASE_URL.
import { connect, databaseUrlFromEnv, migrate } from './index.ts';

const sql = connect(databaseUrlFromEnv(), { max: 1, applicationName: 'nyc-nj-parking-migrate' });
try {
  const applied = await migrate(sql);
  console.log(applied.length === 0 ? 'Migrations: none pending' : `Migrations applied: ${applied.join(', ')}`);
} finally {
  await sql.end();
}
