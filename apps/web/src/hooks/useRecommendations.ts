import type { AreaId, OperatorType } from '@parking/api-client';
import { useQuery } from '@tanstack/react-query';
import { fetchAreaFacilities, fetchRecommendations } from '../services/recommendations.ts';
import { OPERATOR_TYPES } from '../utils/operatorTypes.ts';
import type { Point } from '../utils/location.ts';

/** What a search is around: a point (a place, the device, or a tap), or a whole county or borough (WEB-13). */
export type SearchTarget = { kind: 'point'; point: Point } | { kind: 'area'; area: AreaId };

/** WEB-8: with every operator type chosen, no filter is sent; with none, there's no search. */
export function useRecommendations(target: SearchTarget | null, radius: number, operatorTypes: readonly OperatorType[] = OPERATOR_TYPES) {
  const chosen = OPERATOR_TYPES.filter((type) => operatorTypes.includes(type));
  const filtered = chosen.length < OPERATOR_TYPES.length;
  return useQuery({
    // A point is already rounded (PRIV-3). The query cache is in memory only.
    queryKey: target?.kind === 'area'
      ? ['area', target.area, filtered ? chosen.join(',') : 'all']
      : ['recommendations', target?.point.lat, target?.point.lng, radius, filtered ? chosen.join(',') : 'all'],
    queryFn: () => {
      const options = filtered ? [{ operatorTypes: chosen }] as const : ([] as const);
      return target!.kind === 'area' ? fetchAreaFacilities(target!.area, ...options) : fetchRecommendations(target!.point, radius, ...options);
    },
    enabled: target !== null && chosen.length > 0,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    retry: false,
  });
}
