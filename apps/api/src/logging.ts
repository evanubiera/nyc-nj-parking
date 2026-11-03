// PRIV-2: request logs carry the method, route pattern, status, and duration, never the URL, query string,
// headers, or body. Fastify's own request logging is turned off, and the req/res serializers are reduced
// to the same fields, so a log call that passes a request can't leak more.
import type { FastifyInstance, FastifyRequest } from 'fastify';

export const serializers = {
  req: (request: FastifyRequest): Record<string, unknown> => ({ method: request.method, route: request.routeOptions?.url ?? null }),
  res: (reply: { statusCode: number }): Record<string, unknown> => ({ statusCode: reply.statusCode }),
};

export function registerRequestLog(app: FastifyInstance): void {
  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        route: request.routeOptions.url ?? null,
        statusCode: reply.statusCode,
        responseTime: Math.round(reply.elapsedTime),
      },
      'request',
    );
  });
}

/**
 * What we log about an unexpected error: its name, code, and stack frames. Not its message or other
 * properties, which can carry query parameters (postgres.js errors include `parameters`).
 */
export function errorLogFields(error: unknown): { errorName: string; errorCode: string | null; stack: string | null } {
  if (!(error instanceof Error)) {
    return { errorName: typeof error, errorCode: null, stack: null };
  }
  const code = (error as { code?: unknown }).code;
  return {
    errorName: error.name,
    errorCode: typeof code === 'string' ? code : null,
    stack: error.stack?.split('\n').slice(1).join('\n') ?? null,
  };
}
