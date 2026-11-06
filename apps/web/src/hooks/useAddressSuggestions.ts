import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { MIN_ADDRESS_LENGTH, suggest } from '../services/geocoding.ts';

// Components reach the service through this hook (WEB-3).
export { pointFor, type Suggestion } from '../services/geocoding.ts';

/** How long typing has to pause before a lookup (PRIV-5), so not every keystroke is sent. */
export const TYPING_PAUSE_MS = 300;

/** WEB-11: suggestions for what's typed, after a pause. Cached in memory only (PRIV-5). */
export function useAddressSuggestions(text: string) {
  const [settled, setSettled] = useState(text);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(text), TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const query = settled.trim();
  return useQuery({
    queryKey: ['address-suggestions', query],
    queryFn: ({ signal }) => suggest(query, signal),
    enabled: query.length >= MIN_ADDRESS_LENGTH,
    staleTime: 60_000,
    gcTime: 60_000,
    retry: false,
  });
}
