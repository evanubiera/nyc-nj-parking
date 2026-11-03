import type { ApiClient, ApiError, RecommendedFacility } from '@parking/api-client';
import { roundPoint, type Point } from '../utils/location.ts';
import { apiClient } from './apiClient.ts';

export type RecommendationsResult =
  | { status: 'ok'; results: RecommendedFacility[] }
  | { status: 'error'; code: ApiError['code'] | 'network' };

/** PRIV-3: rounds the point here, the last step before the network, whatever the caller passed. */
export async function fetchRecommendations(point: Point, radius: number, client: ApiClient = apiClient): Promise<RecommendationsResult> {
  const { lat, lng } = roundPoint(point);
  try {
    const { data, error } = await client.GET('/api/parking/recommendations', { params: { query: { lat, lng, radius } } });
    if (data) return { status: 'ok', results: data.results };
    return { status: 'error', code: error && 'code' in error ? error.code : 'internal_error' };
  } catch {
    return { status: 'error', code: 'network' };
  }
}
