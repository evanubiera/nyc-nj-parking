import type { ApiClient, ApiError, AreaId, OperatorType, RecommendedFacility } from '@parking/api-client';
import { roundPoint, type Point } from '../utils/location.ts';
import { apiClient } from './apiClient.ts';

export type RecommendationsResult =
  | { status: 'ok'; results: RecommendedFacility[] }
  | { status: 'error'; code: ApiError['code'] | 'network' };

export interface RecommendationOptions {
  /** REC-7: only these operator types. Leave it out for every type. */
  operatorTypes?: readonly OperatorType[];
  client?: ApiClient;
}

/** PRIV-3: rounds the point here, the last step before the network, whatever the caller passed. */
export async function fetchRecommendations(
  point: Point,
  radius: number,
  { operatorTypes, client = apiClient }: RecommendationOptions = {},
): Promise<RecommendationsResult> {
  const { lat, lng } = roundPoint(point);
  const query = operatorTypes ? { lat, lng, radius, operatorType: [...operatorTypes] } : { lat, lng, radius };
  try {
    const { data, error } = await client.GET('/api/parking/recommendations', { params: { query } });
    if (data) return { status: 'ok', results: data.results };
    return { status: 'error', code: error && 'code' in error ? error.code : 'internal_error' };
  } catch {
    return { status: 'error', code: 'network' };
  }
}

/** WEB-13, REC-11: every facility in a county or borough, by town. No point is sent. */
export async function fetchAreaFacilities(
  area: AreaId,
  { operatorTypes, client = apiClient }: RecommendationOptions = {},
): Promise<RecommendationsResult> {
  const query = operatorTypes ? { operatorType: [...operatorTypes] } : {};
  try {
    const { data, error } = await client.GET('/api/parking/areas/{area}/facilities', { params: { path: { area }, query } });
    if (data) return { status: 'ok', results: data.results };
    return { status: 'error', code: error && 'code' in error ? error.code : 'internal_error' };
  } catch {
    return { status: 'error', code: 'network' };
  }
}
