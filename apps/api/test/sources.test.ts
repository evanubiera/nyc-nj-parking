import { connectTest, resetData } from '@parking/db/testing';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { seedSource } from './seed.ts';

const sql = connectTest(inject('testDatabase'));
afterAll(() => sql.end());
beforeEach(() => resetData(sql));

describe('GET /api/sources', () => {
  it('ATT-3 lists each source with its publisher, links, credit, changes, and data date', async () => {
    await seedSource(sql, 'nyc-meters-offstreet', null);
    await seedSource(sql, 'nyc-facdb-dot');
    const app = await buildApp({ sql, logger: false });

    const response = await app.inject({ method: 'GET', url: '/api/sources' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      sources: [
        {
          id: 'nyc-facdb-dot',
          publisher: 'Test Publisher',
          title: 'Dataset nyc-facdb-dot',
          datasetUrl: 'https://data.example.test/d/nyc-facdb-dot',
          termsUrl: 'https://data.example.test/terms',
          creditText: null,
          modifications: ['names_reformatted'],
          dataUpdatedAt: '2026-07-16T13:33:28.000Z',
        },
        expect.objectContaining({ id: 'nyc-meters-offstreet', dataUpdatedAt: null }),
      ],
    });
    await app.close();
  });
});
