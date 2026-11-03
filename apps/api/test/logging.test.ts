import type { Health } from '@parking/api-client';
import { connectTest } from '@parking/db/testing';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { afterAll, describe, expect, inject, it } from 'vitest';
import { Handlers } from '../src/handlers.ts';
import { appWithLogs } from './support.ts';

const sql = connectTest(inject('testDatabase'));
afterAll(() => sql.end());

const LATITUDE = '40.71234';
const LONGITUDE = '-73.98765';

function expectNoLocation(text: string): void {
  expect(text).not.toContain(LATITUDE);
  expect(text).not.toContain(LONGITUDE);
  expect(text).not.toMatch(/lat=|lng=|\?/);
}

describe('request logs', () => {
  it('PRIV-2 log method, route pattern, status, and duration, never the query string', async () => {
    const { app, logs } = await appWithLogs(sql);

    await app.inject({ method: 'GET', url: `/api/health?lat=${LATITUDE}&lng=${LONGITUDE}` });
    await app.close();

    const request = logs.entries.find((entry) => entry.msg === 'request');
    expect(request).toMatchObject({ method: 'GET', route: '/api/health', statusCode: 200 });
    expect(typeof request?.responseTime).toBe('number');
    expect(Object.keys(request ?? {})).not.toContain('url');
    expectNoLocation(logs.text);
  });

  it('PRIV-2 never log the URL of a request that matches no route', async () => {
    const { app, logs } = await appWithLogs(sql);

    await app.inject({ method: 'GET', url: `/api/somewhere/${LATITUDE}?lat=${LATITUDE}&lng=${LONGITUDE}` });
    await app.close();

    expect(logs.entries.find((entry) => entry.msg === 'request')).toMatchObject({ route: null, statusCode: 404 });
    expectNoLocation(logs.text);
  });

  it('PRIV-2 log an unexpected error by name and stack, without its message or parameters', async () => {
    class FailingHandlers extends Handlers {
      override async getHealth(_request: FastifyRequest, _reply: FastifyReply): Promise<Health> {
        const error = Object.assign(new Error(`query failed near ${LATITUDE}, ${LONGITUDE}`), {
          code: '42P01',
          parameters: [Number(LATITUDE), Number(LONGITUDE)],
        });
        throw error;
      }
    }
    const { app, logs } = await appWithLogs(sql, { handlers: new FailingHandlers(sql) });

    const response = await app.inject({ method: 'GET', url: `/api/health?lat=${LATITUDE}&lng=${LONGITUDE}` });
    await app.close();

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ code: 'internal_error' });
    expect(logs.entries.find((entry) => entry.msg === 'request failed')).toMatchObject({
      errorName: 'Error',
      errorCode: '42P01',
    });
    expectNoLocation(logs.text);
  });
});
