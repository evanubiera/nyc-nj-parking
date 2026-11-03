// FND-4: every error is { code } (plus `parameter` for invalid parameters), with codes from specs/05-api.md.
import type { ApiError } from '@parking/api-client';
import type { FastifyError, FastifyInstance } from 'fastify';
import { errorLogFields } from './logging.ts';

export type ErrorCode = ApiError['code'];

/** A path from the contract, such as /api/health or /api/facilities/{id}, as a matcher. */
export function pathMatcher(contractPath: string): RegExp {
  const pattern = contractPath
    .split('/')
    .map((segment) => (/^\{[^}]+\}$/.test(segment) ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${pattern}/?$`);
}

export function registerErrorHandling(app: FastifyInstance, contractPaths: readonly string[]): void {
  const matchers = contractPaths.map(pathMatcher);

  app.setNotFoundHandler(async (request, reply) => {
    const path = request.url.split('?', 1)[0] ?? '';
    const known = matchers.some((matcher) => matcher.test(path));
    const body: ApiError = { code: known ? 'method_not_allowed' : 'not_found' };
    return reply.code(known ? 405 : 404).send(body);
  });

  app.setErrorHandler(async (error: FastifyError, request, reply) => {
    if (error.validation) {
      const first = error.validation[0];
      const missing = (first?.params as { missingProperty?: unknown } | undefined)?.missingProperty;
      const fromPath = first?.instancePath?.split('/').filter(Boolean)[0];
      const parameter = typeof missing === 'string' ? missing : fromPath;
      const body: ApiError = parameter ? { code: 'request.invalid_parameter', parameter } : { code: 'request.invalid_parameter' };
      return reply.code(400).send(body);
    }
    const status = error.statusCode ?? 500;
    if (status >= 400 && status < 500) {
      const body: ApiError = { code: 'request.malformed' };
      return reply.code(400).send(body);
    }
    request.log.error(errorLogFields(error), 'request failed');
    const body: ApiError = { code: 'internal_error' };
    return reply.code(500).send(body);
  });
}
