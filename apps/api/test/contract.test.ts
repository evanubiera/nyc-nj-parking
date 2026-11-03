import type { Health } from '@parking/api-client';
import { connectTest } from '@parking/db/testing';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { afterAll, describe, expect, inject, it } from 'vitest';
import { buildApp, readContract } from '../src/app.ts';
import { handlerOperationIds, Handlers } from '../src/handlers.ts';

const sql = connectTest(inject('testDatabase'));
afterAll(() => sql.end());

describe('contract', () => {
  it('FND-2 has a handler for every contract operation and no handler without one', () => {
    const operationIds = readContract().operations.map((operation) => operation.operationId);

    expect(operationIds.every((id) => id.length > 0)).toBe(true);
    expect([...handlerOperationIds].sort()).toEqual([...operationIds].sort());
  });

  it('FND-2 registers each contract operation as a route', async () => {
    const app = await buildApp({ sql, logger: false });
    await app.ready();

    for (const { method, path } of readContract().operations) {
      expect(app.hasRoute({ method, url: path }), `${method} ${path}`).toBe(true);
    }
    await app.close();
  });

  it('FND-2 drops response fields that are not in the response schema', async () => {
    class LeakyHandlers extends Handlers {
      override async getHealth(_request: FastifyRequest, reply: FastifyReply): Promise<Health> {
        reply.code(200);
        return { status: 'ok', debugLatitude: 40.71234 } as Health;
      }
    }
    const app = await buildApp({ sql, logger: false, handlers: new LeakyHandlers(sql) });

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.json()).toEqual({ status: 'ok' });
    expect(response.body).not.toContain('40.71234');
    await app.close();
  });
});
