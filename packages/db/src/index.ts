import postgres from 'postgres';

export { migrate } from './migrate.ts';
export { DAYS, daysToMask, maskToDays, timeOfDay, type DayCode } from './encoding.ts';

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

/**
 * A text[] parameter. Always use this instead of sql.array for strings: postgres.js infers an array's
 * type from types it loads after connecting, so in a connection's first query an inferred string array
 * is sent as plain text and PostgreSQL rejects it (found by the first live ingest, 2026-11-03).
 */
export const TEXT_ARRAY_OID = 1009;

export function textArray(sql: Sql | TransactionSql, values: readonly string[]) {
  return sql.array([...values], TEXT_ARRAY_OID);
}

/** Reads DATABASE_URL, failing with a clear message when it's missing. */
export function databaseUrlFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. See .env.example.');
  }
  return url;
}
