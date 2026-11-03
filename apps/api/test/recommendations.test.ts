import type { RecommendationList } from '@parking/api-client';
import { connectTest, resetData } from '@parking/db/testing';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { seedFacility, seedGrid } from './seed.ts';
import { appWithLogs, unreachableDatabase } from './support.ts';

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

// The Delancey and Essex garage, and points a known distance north of it.
const ORIGIN = { lat: 40.719, lng: -73.988 };
const north = (meters: number) => ORIGIN.lat + meters / 111_195;

async function recommend(query: string) {
  const response = await app.inject({ method: 'GET', url: `/api/parking/recommendations?${query}` });
  return { status: response.statusCode, body: response.json() as RecommendationList & { code?: string; parameter?: string }, raw: response.body };
}

describe('GET /api/parking/recommendations', () => {
  it('REC-1 returns active facilities within the radius, nearest first', async () => {
    await seedFacility(sql, { id: 'far', lat: north(1500), lng: ORIGIN.lng });
    await seedFacility(sql, { id: 'near', lat: north(300), lng: ORIGIN.lng });
    await seedFacility(sql, { id: 'outside', lat: north(2500), lng: ORIGIN.lng });
    await seedFacility(sql, { id: 'withdrawn', lat: north(100), lng: ORIGIN.lng, status: 'withdrawn' });

    const { status, body } = await recommend(`lat=${ORIGIN.lat}&lng=${ORIGIN.lng}`);

    expect(status).toBe(200);
    expect(body.results.map((result) => result.id)).toEqual(['near', 'far']);
  });

  it('REC-1 returns at most 50 results', async () => {
    await seedGrid(sql, 400, ORIGIN.lat, ORIGIN.lng);

    const { body } = await recommend(`lat=${ORIGIN.lat}&lng=${ORIGIN.lng}&radius=10000`);

    expect(body.results).toHaveLength(50);
    const distances = body.results.map((result) => result.distanceMeters);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('REC-2 uses a 2 km radius unless told otherwise', async () => {
    await seedFacility(sql, { id: 'at-1900', lat: north(1900), lng: ORIGIN.lng });
    await seedFacility(sql, { id: 'at-2100', lat: north(2100), lng: ORIGIN.lng });

    const byDefault = await recommend(`lat=${ORIGIN.lat}&lng=${ORIGIN.lng}`);
    const wider = await recommend(`lat=${ORIGIN.lat}&lng=${ORIGIN.lng}&radius=5000`);

    expect(byDefault.body.results.map((result) => result.id)).toEqual(['at-1900']);
    expect(wider.body.results.map((result) => result.id)).toEqual(['at-1900', 'at-2100']);
  });

  it.each([
    ['radius=99', 'radius'],
    ['radius=10001', 'radius'],
    ['radius=wide', 'radius'],
    ['lat=91', 'lat'],
    ['lat=north', 'lat'],
  ])('REC-2 rejects %s with request.invalid_parameter', async (bad, parameter) => {
    const params = new URLSearchParams({ lat: String(ORIGIN.lat), lng: String(ORIGIN.lng) });
    const [name, value] = bad.split('=') as [string, string];
    params.set(name, value);

    const { status, body } = await recommend(params.toString());

    expect(status).toBe(400);
    expect(body).toEqual({ code: 'request.invalid_parameter', parameter });
  });

  it('REC-2 names a missing coordinate', async () => {
    const { status, body } = await recommend(`lng=${ORIGIN.lng}`);

    expect(status).toBe(400);
    expect(body).toEqual({ code: 'request.invalid_parameter', parameter: 'lat' });
  });

  it.each([
    ['Baltimore', 39.29, -76.612],
    ['Albany', 42.652, -73.757],
    ['the Atlantic', 40.5, -72.5],
  ])('REC-3 answers a point in %s with 422 location.out_of_area', async (_, lat, lng) => {
    const { status, body } = await recommend(`lat=${lat}&lng=${lng}`);

    expect(status).toBe(422);
    expect(body).toEqual({ code: 'location.out_of_area' });
  });

  it.each([
    ['Newark, with no NJ data yet', 40.7357, -74.1724],
    ['Philadelphia, inside the box though not in NJ', 39.95, -75.165],
  ])('REC-3 returns an empty list for %s', async (_, lat, lng) => {
    const { status, body } = await recommend(`lat=${lat}&lng=${lng}`);

    expect(status).toBe(200);
    expect(body).toEqual({ results: [] });
  });

  it('REC-4 describes a metered field: operator, address, distance, metered hours, and sources', async () => {
    await seedFacility(sql, {
      id: 'nyc-dot-avenue-m',
      name: 'Avenue M Municipal Parking Field',
      lat: north(337),
      lng: ORIGIN.lng,
      addressLine: '1624 Chestnut Avenue',
      sourceIds: ['nyc-facdb-dot', 'nyc-meters-offstreet'],
      meterPeriods: [
        { days: 63, startsAt: '07:00', endsAt: '22:00', maxStayMinutes: 900, vehicleClass: 'passenger', sourceText: '15HR Pas Mon-Sat 0700-2200' },
        { days: 63, startsAt: '07:00', endsAt: '22:00', maxStayMinutes: 240, vehicleClass: 'passenger', sourceText: '4HR Pas Mon-Sat 0700-2200' },
      ],
    });

    const { body } = await recommend(`lat=${ORIGIN.lat}&lng=${ORIGIN.lng}`);

    expect(body.results[0]).toEqual({
      id: 'nyc-dot-avenue-m',
      name: 'Avenue M Municipal Parking Field',
      kind: 'field',
      operator: { name: 'NYC Department of Transportation', type: 'municipal' },
      address: { line: '1624 Chestnut Avenue', locality: 'Brooklyn', region: 'NY' },
      location: { lat: expect.closeTo(north(337), 5), lng: ORIGIN.lng },
      distanceMeters: 340,
      openingHours: null,
      meteredHours: {
        timeZone: 'America/New_York',
        periods: [
          { days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], from: '07:00', to: '22:00', maxStayMinutes: 240, vehicleClass: 'passenger' },
          { days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], from: '07:00', to: '22:00', maxStayMinutes: 900, vehicleClass: 'passenger' },
        ],
        sourceText: ['15HR Pas Mon-Sat 0700-2200', '4HR Pas Mon-Sat 0700-2200'],
      },
      rates: [],
      officialUrl: 'https://www.nyc.gov/html/dot/html/motorist/parkinglist.shtml#kings',
      sources: [
        { id: 'nyc-facdb-dot', dataUpdatedAt: '2026-07-16T13:33:28.000Z' },
        { id: 'nyc-meters-offstreet', dataUpdatedAt: '2026-07-16T13:33:28.000Z' },
      ],
    });
  });

  it('REC-6 still returns a facility no source gives hours for, with both hours null', async () => {
    await seedFacility(sql, { id: 'nyc-dot-delancey-essex', kind: 'garage', lat: ORIGIN.lat, lng: ORIGIN.lng });

    const { body } = await recommend(`lat=${ORIGIN.lat}&lng=${ORIGIN.lng}`);

    expect(body.results[0]).toMatchObject({
      id: 'nyc-dot-delancey-essex',
      kind: 'garage',
      openingHours: null,
      meteredHours: null,
      distanceMeters: 0,
      officialUrl: 'https://www.nyc.gov/html/dot/html/motorist/parkinglist.shtml#kings',
    });
  });

  it('PRIV-3 rounds the point to 3 decimal places before using it', async () => {
    await seedFacility(sql, { id: 'at-rounded-point', lat: 40.719, lng: -73.988 });

    const a = await recommend('lat=40.71949&lng=-73.98751');
    const b = await recommend('lat=40.71851&lng=-73.98849');

    expect(a.body.results[0]?.distanceMeters).toBe(0);
    expect(b.raw).toBe(a.raw);
  });

  it('PRIV-3 never echoes the request coordinates', async () => {
    await seedFacility(sql, { id: 'nearby', lat: north(500), lng: ORIGIN.lng });

    const { raw } = await recommend('lat=40.71913&lng=-73.98827');

    expect(raw).not.toContain('40.71913');
    expect(raw).not.toContain('73.98827');
    expect(raw).not.toContain('40.719,');
    expect(raw).not.toContain('-73.988,');
  });

  it('PRIV-2 logs a recommendation request without its coordinates', async () => {
    const { app: logged, logs } = await appWithLogs(sql);

    await logged.inject({ method: 'GET', url: '/api/parking/recommendations?lat=40.71913&lng=-73.98827&radius=3000' });
    await logged.close();

    expect(logs.entries.find((entry) => entry.msg === 'request')).toMatchObject({ route: '/api/parking/recommendations', statusCode: 200 });
    expect(logs.text).not.toMatch(/40\.719|73\.988|radius|lat=/);
  });

  it('REC-5 answers within 300 ms at the 95th percentile with 5,000 facilities', async () => {
    await seedGrid(sql, 5000, 40.6, -74.05);
    const times: number[] = [];

    for (let i = 0; i < 40; i += 1) {
      const lat = (40.62 + (i % 10) * 0.015).toFixed(3);
      const lng = (-74.04 + Math.floor(i / 10) * 0.02).toFixed(3);
      const started = performance.now();
      const { status } = await recommend(`lat=${lat}&lng=${lng}`);
      times.push(performance.now() - started);
      expect(status).toBe(200);
    }

    const p95 = [...times].sort((a, b) => a - b)[Math.ceil(times.length * 0.95) - 1]!;
    expect(p95).toBeLessThan(300);
  });

  it('answers 503 service_unavailable when the database does not respond', async () => {
    const down = unreachableDatabase();
    const offline = await buildApp({ sql: down, logger: false });

    const response = await offline.inject({ method: 'GET', url: `/api/parking/recommendations?lat=${ORIGIN.lat}&lng=${ORIGIN.lng}` });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: 'service_unavailable' });
    await offline.close();
    await down.end({ timeout: 0 });
  });
});
