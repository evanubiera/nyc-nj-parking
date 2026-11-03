import { databaseUrlFromEnv } from '@parking/db';
import pino, { type Logger } from 'pino';
import { UpstreamHttp } from './http.ts';

export interface WorkerConfig {
  databaseUrl: string;
  http: UpstreamHttp;
  logger: Logger;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return {
    databaseUrl: databaseUrlFromEnv(env),
    http: new UpstreamHttp({
      ...(env.CONTACT_URL ? { contactUrl: env.CONTACT_URL } : {}),
      ...(env.SOCRATA_APP_TOKEN ? { socrataAppToken: env.SOCRATA_APP_TOKEN } : {}),
    }),
    // ING-5: nothing here logs headers or bodies. The logger has no serializers for them on purpose.
    logger: pino({ level: env.LOG_LEVEL ?? 'info', base: { service: 'worker' } }),
  };
}
