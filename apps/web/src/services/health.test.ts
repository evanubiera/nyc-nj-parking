import { createApiClient } from '@parking/api-client';
import { describe, expect, it } from 'vitest';
import { fetchServiceHealth } from './health.ts';

function clientAnswering(answer: () => Promise<Response>) {
  return createApiClient({ baseUrl: 'http://localhost', fetch: answer });
}

describe('fetchServiceHealth', () => {
  it('FND-3 reports ok when the API answers 200 ok', async () => {
    const client = clientAnswering(async () => Response.json({ status: 'ok' }));

    expect(await fetchServiceHealth(client)).toBe('ok');
  });

  it('FND-3 reports unavailable when the API answers 503', async () => {
    const client = clientAnswering(async () => Response.json({ status: 'unavailable' }, { status: 503 }));

    expect(await fetchServiceHealth(client)).toBe('unavailable');
  });

  it('FND-3 reports unavailable when the API cannot be reached', async () => {
    const client = clientAnswering(async () => {
      throw new TypeError('Failed to fetch');
    });

    expect(await fetchServiceHealth(client)).toBe('unavailable');
  });
});
