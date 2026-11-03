import { useQuery } from '@tanstack/react-query';
import { fetchSources } from '../services/sources.ts';

export function useSources() {
  return useQuery({ queryKey: ['sources'], queryFn: () => fetchSources(), staleTime: 60 * 60_000, retry: false });
}
