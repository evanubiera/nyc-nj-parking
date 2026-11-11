import { useQuery } from '@tanstack/react-query';
import { loadAreas } from '../services/areas.ts';

/** WEB-13: the counties and boroughs, with their towns, once something asks for them. */
export function useAreas(enabled: boolean) {
  return useQuery({ queryKey: ['areas'], queryFn: loadAreas, enabled, staleTime: Infinity, gcTime: Infinity, retry: false });
}
