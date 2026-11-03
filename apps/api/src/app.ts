import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Sql } from '@parking/db';
import Fastify, { LogController, type FastifyInstance, type FastifyServerOptions } from 'fastify';
import openapiGlue from 'fastify-openapi-glue';
import { parse } from 'yaml';
import { registerErrorHandling } from './errors.ts';
import { Handlers } from './handlers.ts';
import { registerRequestLog, serializers } from './logging.ts';

export const CONTRACT_PATH = fileURLToPath(new URL('../../../api/openapi.yaml', import.meta.url));

export interface AppOptions {
  sql: Sql;
  /** pino options. Tests pass a stream to read the logs; `false` turns logging off. */
  logger?: { level?: string; stream?: NodeJS.WritableStream } | false;
  /** Replaces the handlers, for tests. */
  handlers?: Handlers;
}

export async function buildApp({ sql, logger = { level: 'info' }, handlers }: AppOptions): Promise<FastifyInstance> {
  const loggerOptions: FastifyServerOptions['logger'] = logger === false ? false : { ...logger, serializers };
  // Fastify's own request lines include the URL, so they're off; registerRequestLog writes ours (PRIV-2).
  const app = Fastify({ logger: loggerOptions, logController: new LogController({ disableRequestLogging: true }) });

  registerRequestLog(app);
  registerErrorHandling(app, contractPaths());
  await app.register(openapiGlue, { specification: CONTRACT_PATH, serviceHandlers: handlers ?? new Handlers(sql) });

  return app;
}

export interface ContractOperation {
  operationId: string;
  method: string;
  path: string;
}

export function readContract(): { paths: string[]; operations: ContractOperation[] } {
  const document = parse(readFileSync(CONTRACT_PATH, 'utf8')) as {
    paths: Record<string, Record<string, { operationId?: string }>>;
  };
  const operations = Object.entries(document.paths).flatMap(([path, item]) =>
    Object.entries(item)
      .filter(([method]) => HTTP_METHODS.has(method))
      .map(([method, operation]) => ({ operationId: operation.operationId ?? '', method: method.toUpperCase(), path })),
  );
  return { paths: Object.keys(document.paths), operations };
}

const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

function contractPaths(): string[] {
  return readContract().paths;
}
