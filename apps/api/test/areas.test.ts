import type { AreaFacilityList } from '@parking/api-client';
import { connectTest, resetData } from '@parking/db/testing';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { seedFacility } from './seed.ts';

const sql = connectTest(inject('testDatabase'));
let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ sql, logger: false });
});
afterAll(async () => {
  await app.close();
  await sql.end();
});
beforeEach(() => resetData(sql));

async function listArea(path: string) {
  const response = await app.inject({ method: 'GET', url: `/api/parking/areas/${path}` });
  return { status: response.statusCode, body: response.json() as AreaFacilityList & { code?: string; parameter?: string } };
}

describe('GET /api/parking/areas/{area}/facilities', () => {
  it('REC-11 returns every active facility in the area, by town, then name, with no distance', async () => {
    await seedFacility(sql, { id: 'madison-b', name: 'B Lot', locality: 'Madison', area: 'nj-morris', lat: 40.759, lng: -74.417 });
    await seedFacility(sql, { id: 'morristown', name: 'Z Garage', locality: 'Morristown', area: 'nj-morris', lat: 40.797, lng: -74.481 });
    await seedFacility(sql, { id: 'madison-a', name: 'A Lot', locality: 'Madison', area: 'nj-morris', lat: 40.758, lng: -74.418 });
    await seedFacility(sql, { id: 'elsewhere', locality: 'Westwood', area: 'nj-bergen', lat: 40.991, lng: -74.031 });
    await seedFacility(sql, { id: 'gone', locality: 'Madison', area: 'nj-morris', lat: 40.76, lng: -74.41, status: 'withdrawn' });

    const { status, body } = await listArea('nj-morris/facilities');

    expect(status).toBe(200);
    expect(body.results.map((result) => result.id)).toEqual(['madison-a', 'madison-b', 'morristown']);
    expect(body.results.every((result) => result.distanceMeters === null)).toBe(true);
    expect(body.results[0]?.sources).toEqual([{ id: 'test-source', dataUpdatedAt: '2026-07-16T13:33:28.000Z' }]);
  });

  it('REC-11 has no cap of 50: an area lists all its facilities', async () => {
    for (let index = 0; index < 60; index += 1) {
      await seedFacility(sql, { id: `lot-${String(index).padStart(2, '0')}`, area: 'nj-hudson', locality: 'Jersey City', lat: 40.72 + index / 10_000, lng: -74.05 });
    }

    expect((await listArea('nj-hudson/facilities')).body.results).toHaveLength(60);
  });

  it('REC-7 filters an area by operator type', async () => {
    await seedFacility(sql, { id: 'city', area: 'ny-brooklyn', lat: 40.69, lng: -73.99 });
    await seedFacility(sql, { id: 'site', area: 'ny-brooklyn', lat: 40.7, lng: -73.99, unconfirmed: true });

    const { body } = await listArea('ny-brooklyn/facilities?operatorType=unknown');

    expect(body.results.map((result) => result.id)).toEqual(['site']);
  });

  it('FND-4 answers an unknown area with request.invalid_parameter', async () => {
    const { status, body } = await listArea('nj-atlantis/facilities');

    expect(status).toBe(400);
    expect(body).toMatchObject({ code: 'request.invalid_parameter', parameter: 'area' });
  });
});
