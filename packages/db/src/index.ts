import postgres from 'postgres';

export { migrate } from './migrate.ts';

export type Sql = postgres.Sql;
export type TransactionSql = postgres.TransactionSql;

export interface ConnectOptions {
  /** Pool size. Use 1 against the PGlite test fallback, which has a single backend. */
  max?: number;
  connectTimeoutSeconds?: number;
  applicationName?: string;
}

export function connect(url: string, options: ConnectOptions = {}): Sql {
  return postgres(url, {
    max: options.max ?? 10,
    connect_timeout: options.connectTimeoutSeconds ?? 5,
    connection: { application_name: options.applicationName ?? 'nyc-nj-parking' },
    // postgres.js prints server notices to the console by default. We keep logs to what we choose.
    onnotice: () => {},
  });
}

/** Reads DATABASE_URL, failing with a clear message when it's missing. */
export function databaseUrlFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. See .env.example.');
  }
  return url;
}
