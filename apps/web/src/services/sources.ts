import type { ApiClient, Source } from '@parking/api-client';
import { apiClient } from './apiClient.ts';

/** ATT-3. Throws when the list can't be loaded, so the hook can show its error state. */
export async function fetchSources(client: ApiClient = apiClient): Promise<Source[]> {
  const { data } = await client.GET('/api/sources');
  if (!data) throw new Error('sources unavailable');
  return data.sources;
}
