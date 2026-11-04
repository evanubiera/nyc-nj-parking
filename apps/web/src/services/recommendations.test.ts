import { createApiClient } from '@parking/api-client';
import { describe, expect, it } from 'vitest';
import { avenueM } from '../test/facilities.ts';
import { fetchRecommendations } from './recommendations.ts';

function clientRecording(answer: () => Promise<Response>) {
  const urls: URL[] = [];
  const client = createApiClient({
    baseUrl: 'http://localhost',
    fetch: async (input) => {
      urls.push(new URL((input as Request).url));
      return answer();
    },
  });
  return { client, urls };
}

describe('fetchRecommendations', () => {
  it('PRIV-3 sends only the point rounded to 3 decimal places', async () => {
    const { client, urls } = clientRecording(async () => Response.json({ results: [avenueM] }));

    const result = await fetchRecommendations({ lat: 40.718946, lng: -73.988287 }, 2000, { client });

    expect(result).toEqual({ status: 'ok', results: [avenueM] });
    expect(urls[0]?.pathname).toBe('/api/parking/recommendations');
    expect(Object.fromEntries(urls[0]!.searchParams)).toEqual({ lat: '40.719', lng: '-73.988', radius: '2000' });
  });

  it('REC-3 passes on the error code', async () => {
    const { client } = clientRecording(async () => Response.json({ code: 'location.out_of_area' }, { status: 422 }));

    expect(await fetchRecommendations({ lat: 39.29, lng: -76.612 }, 2000, { client })).toEqual({ status: 'error', code: 'location.out_of_area' });
  });

  it('reports a network failure as its own code', async () => {
    const { client } = clientRecording(async () => {
      throw new TypeError('Failed to fetch');
    });

    expect(await fetchRecommendations({ lat: 40.719, lng: -73.988 }, 2000, { client })).toEqual({ status: 'error', code: 'network' });
  });

  it('REC-7 sends each chosen operator type as its own parameter', async () => {
    const { client, urls } = clientRecording(async () => Response.json({ results: [] }));

    await fetchRecommendations({ lat: 40.797, lng: -74.474 }, 2000, { client, operatorTypes: ['municipal', 'transit_agency'] });

    expect(urls[0]!.searchParams.getAll('operatorType')).toEqual(['municipal', 'transit_agency']);
  });
});
