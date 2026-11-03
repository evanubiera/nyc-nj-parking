import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { IngestionError } from '../src/errors.ts';
import { DEFAULT_TIMEOUT_MS, UpstreamHttp } from '../src/http.ts';

const TOKEN = 'test-token-abc123';
let server: Server;
let base: string;
let seen: IncomingHttpHeaders[] = [];

beforeAll(async () => {
  server = createServer((request, response) => {
    seen.push(request.headers);
    if (request.url === '/slow') return; // never answers
    if (request.url === '/forbidden') {
      response.writeHead(403, { 'content-type': 'application/json' }).end('{"error":"forbidden"}');
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' }).end('{"ok":true}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});
beforeEach(() => {
  seen = [];
});

async function failure(promise: Promise<unknown>): Promise<IngestionError> {
  const error = await promise.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(IngestionError);
  return error as IngestionError;
}

describe('UpstreamHttp', () => {
  it('ING-5 sends a User-Agent with the app name and contact URL', async () => {
    const http = new UpstreamHttp({ contactUrl: 'https://example.test/contact' });

    const response = await http.get(`${base}/data`);

    expect(seen[0]?.['user-agent']).toBe('nyc-nj-parking-worker/0.1.0 (+https://example.test/contact)');
    expect(seen[0]?.accept).toBe('application/json');
    expect(new TextDecoder().decode(response.body)).toBe('{"ok":true}');
    expect(response.contentType).toBe('application/json; charset=utf-8');
  });

  it('ING-5 sends the Socrata app token in X-App-Token only for Socrata sources', async () => {
    const http = new UpstreamHttp({ socrataAppToken: TOKEN });

    await http.get(`${base}/socrata`, { socrata: true });
    await http.get(`${base}/arcgis`);

    expect(seen[0]?.['x-app-token']).toBe(TOKEN);
    expect(seen[1]?.['x-app-token']).toBeUndefined();
  });

  it('ING-5 times out after 30 seconds by default', async () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(30_000);
    const http = new UpstreamHttp({ timeoutMs: 100 });

    const error = await failure(http.get(`${base}/slow`));

    expect(error.code).toBe('upstream.timeout');
  });

  it('ING-5 reports an error status by code, without the token', async () => {
    const http = new UpstreamHttp({ socrataAppToken: TOKEN });

    const error = await failure(http.get(`${base}/forbidden`, { socrata: true }));

    expect(error.code).toBe('upstream.http_status');
    expect(`${error.message} ${JSON.stringify(error)} ${error.stack}`).not.toContain(TOKEN);
  });

  it('ING-5 reports an unreachable host as upstream.network', async () => {
    const http = new UpstreamHttp();

    const error = await failure(http.get('http://127.0.0.1:9/nothing'));

    expect(error.code).toBe('upstream.network');
  });
});
