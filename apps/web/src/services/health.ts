import type { ApiClient } from '@parking/api-client';
import { apiClient } from './apiClient.ts';

export type ServiceHealth = 'ok' | 'unavailable';

/** FND-3, as the web app sees it. Any failure, including a network error, counts as unavailable. */
export async function fetchServiceHealth(client: ApiClient = apiClient): Promise<ServiceHealth> {
  try {
    const { data } = await client.GET('/api/health');
    return data?.status === 'ok' ? 'ok' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}
