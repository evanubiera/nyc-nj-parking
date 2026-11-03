import { connectTest } from '@parking/db/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { pathMatcher } from '../src/errors.ts';

const sql = connectTest(inject('testDatabase'));
let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ sql, logger: false });
});
afterAll(async () => {
  await app.close();
  await sql.end();
});

describe('errors', () => {
  it('FND-4 answers an unknown path with 404 not_found and nothing else', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/nothing-here' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: 'not_found' });
  });

  it('FND-4 answers a known path with the wrong method with 405 method_not_allowed', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/health', payload: {} });

    expect(response.statusCode).toBe(405);
    expect(response.json()).toEqual({ code: 'method_not_allowed' });
  });

  describe('on routes with request schemas', () => {
    // Slice 0's contract has no parameters or bodies, so these routes exist only in this test.
    let testApp: FastifyInstance;
    beforeAll(async () => {
      testApp = await buildApp({ sql, logger: false });
      testApp.post('/test/echo', async (request) => ({ received: request.body }));
      testApp.get(
        '/test/search',
        {
          schema: {
            querystring: {
              type: 'object',
              required: ['radius'],
              properties: { radius: { type: 'integer', minimum: 100, maximum: 10_000 } },
            },
          },
        },
        async () => ({ ok: true }),
      );
      await testApp.ready();
    });
    afterAll(() => testApp.close());

    it('FND-4 answers a body that cannot be parsed with 400 request.malformed', async () => {
      const response = await testApp.inject({
        method: 'POST',
        url: '/test/echo',
        headers: { 'content-type': 'application/json' },
        payload: '{not json',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ code: 'request.malformed' });
    });

    it('FND-4 names the parameter that is out of range', async () => {
      const response = await testApp.inject({ method: 'GET', url: '/test/search?radius=5' });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ code: 'request.invalid_parameter', parameter: 'radius' });
    });

    it('FND-4 names the parameter that is missing', async () => {
      const response = await testApp.inject({ method: 'GET', url: '/test/search' });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ code: 'request.invalid_parameter', parameter: 'radius' });
    });
  });

  it('FND-4 matches contract paths with parameters', () => {
    const matcher = pathMatcher('/api/facilities/{id}');

    expect(matcher.test('/api/facilities/nyc-dot-bay-ridge')).toBe(true);
    expect(matcher.test('/api/facilities/')).toBe(false);
    expect(matcher.test('/api/facilities/a/b')).toBe(false);
  });
});
