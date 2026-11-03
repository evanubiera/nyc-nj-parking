import { useQuery } from '@tanstack/react-query';
import { fetchRecommendations } from '../services/recommendations.ts';
import type { Point } from '../utils/location.ts';

export function useRecommendations(point: Point | null, radius: number) {
  return useQuery({
    // The point is already rounded (PRIV-3). The query cache is in memory only.
    queryKey: ['recommendations', point?.lat, point?.lng, radius],
    queryFn: () => fetchRecommendations(point!, radius),
    enabled: point !== null,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    retry: false,
  });
}
