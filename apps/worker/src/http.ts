// ING-5: every upstream request names the app, sends the Socrata token in a header for Socrata sources,
// and times out after 30 seconds. Tokens are sent only as headers, so they never appear in URLs or errors.
import { IngestionError } from './errors.ts';

export const DEFAULT_TIMEOUT_MS = 30_000;
const APP = 'nyc-nj-parking-worker/0.1.0';

export interface UpstreamHttpOptions {
  /** Goes in the User-Agent, so publishers can reach us. Required in deployment. */
  contactUrl?: string;
  socrataAppToken?: string;
  timeoutMs?: number;
  /** Replaces the global fetch, for tests. */
  fetch?: typeof globalThis.fetch;
}

export interface UpstreamRequest {
  /** Sends the Socrata app token (X-App-Token) when one is configured. */
  socrata?: boolean;
  accept?: string;
}

export interface UpstreamResponse {
  body: Uint8Array;
  contentType: string;
  headers: Headers;
}

export class UpstreamHttp {
  readonly userAgent: string;
  readonly #token: string | undefined;
  readonly #timeoutMs: number;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: UpstreamHttpOptions = {}) {
    this.userAgent = options.contactUrl ? `${APP} (+${options.contactUrl})` : APP;
    this.#token = options.socrataAppToken || undefined;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async get(url: string, request: UpstreamRequest = {}): Promise<UpstreamResponse> {
    const headers = new Headers({ 'user-agent': this.userAgent, accept: request.accept ?? 'application/json' });
    if (request.socrata && this.#token) {
      headers.set('x-app-token', this.#token);
    }

    let response: Response;
    try {
      response = await this.#fetch(url, { headers, signal: AbortSignal.timeout(this.#timeoutMs), redirect: 'follow' });
    } catch (error) {
      const timedOut = error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
      throw new IngestionError(timedOut ? 'upstream.timeout' : 'upstream.network', `GET ${new URL(url).host} failed`);
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new IngestionError('upstream.http_status', `GET ${new URL(url).host} answered ${response.status}`);
    }

    try {
      const body = new Uint8Array(await response.arrayBuffer());
      return { body, contentType: response.headers.get('content-type') ?? 'application/octet-stream', headers: response.headers };
    } catch (error) {
      const timedOut = error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
      throw new IngestionError(timedOut ? 'upstream.timeout' : 'upstream.network', `Reading ${new URL(url).host} failed`);
    }
  }
}
