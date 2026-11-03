import { useQuery } from '@tanstack/react-query';
import { fetchServiceHealth } from '../services/health.ts';

export function useServiceHealth() {
  return useQuery({
    queryKey: ['service-health'],
    queryFn: () => fetchServiceHealth(),
    staleTime: 60_000,
    retry: false,
  });
}
