import { connectTest } from '@parking/db/testing';
import { afterAll, describe, expect, inject, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { unreachableDatabase } from './support.ts';

const sql = connectTest(inject('testDatabase'));
afterAll(() => sql.end());

describe('GET /api/health', () => {
  it('FND-3 answers 200 ok when the database responds', async () => {
    const app = await buildApp({ sql, logger: false });

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('FND-3 answers 503 unavailable when the database does not respond', async () => {
    const down = unreachableDatabase();
    const app = await buildApp({ sql: down, logger: false });

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'unavailable' });
    await app.close();
    await down.end({ timeout: 0 });
  });
});
