import { describe, expect, it } from 'vitest';
import { createApiClient, type Health } from './index.ts';

describe('api-client', () => {
  it('FND-1 calls GET /api/health and returns the typed body', async () => {
    const requests: Request[] = [];
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch: async (input) => {
        requests.push(input as Request);
        return Response.json({ status: 'ok' } satisfies Health);
      },
    });

    const { data, error } = await client.GET('/api/health');

    expect(error).toBeUndefined();
    expect(data).toEqual({ status: 'ok' });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('GET');
    expect(new URL(requests[0]!.url).pathname).toBe('/api/health');
  });

  it('FND-3 returns the 503 health body as the error', async () => {
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch: async () => Response.json({ status: 'unavailable' }, { status: 503 }),
    });

    const { data, error, response } = await client.GET('/api/health');

    expect(response.status).toBe(503);
    expect(data).toBeUndefined();
    expect(error).toEqual({ status: 'unavailable' });
  });
});
