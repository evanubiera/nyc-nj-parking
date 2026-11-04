import type { OperatorType } from '@parking/api-client';
import { useQuery } from '@tanstack/react-query';
import { fetchRecommendations } from '../services/recommendations.ts';
import { OPERATOR_TYPES } from '../utils/operatorTypes.ts';
import type { Point } from '../utils/location.ts';

/** WEB-8: with every operator type chosen, no filter is sent; with none, there's no search. */
export function useRecommendations(point: Point | null, radius: number, operatorTypes: readonly OperatorType[] = OPERATOR_TYPES) {
  const chosen = OPERATOR_TYPES.filter((type) => operatorTypes.includes(type));
  const filtered = chosen.length < OPERATOR_TYPES.length;
  return useQuery({
    // The point is already rounded (PRIV-3). The query cache is in memory only.
    queryKey: ['recommendations', point?.lat, point?.lng, radius, filtered ? chosen.join(',') : 'all'],
    queryFn: () => (filtered ? fetchRecommendations(point!, radius, { operatorTypes: chosen }) : fetchRecommendations(point!, radius)),
    enabled: point !== null && chosen.length > 0,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    retry: false,
  });
}
