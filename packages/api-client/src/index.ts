// A typed client for api/openapi.yaml (ADR-0004). The types in ./generated are produced by
// `pnpm api:generate` and are never edited by hand.
import createClient, { type Client } from 'openapi-fetch';
import type { paths } from './generated/schema.ts';

export type * from './generated/schema.ts';

export type ApiClient = Client<paths>;

export interface ApiClientOptions {
  /** Origin of the API. Empty in the browser, where the API is served from the same origin under /api. */
  baseUrl?: string;
  /** Replaces the global fetch, for tests. */
  fetch?: typeof globalThis.fetch;
}

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  return createClient<paths>({
    baseUrl: options.baseUrl ?? '',
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
}
