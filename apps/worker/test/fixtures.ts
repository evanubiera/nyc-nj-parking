// The sources' real responses, saved on 2026-11-03 with the adapters' own queries (specs/06-sources.md).
import { readFileSync } from 'node:fs';
import { UpstreamHttp } from '../src/http.ts';

const read = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

export const fixtures = {
  facdbRows: read('nyc-facdb-dot.rows.json'),
  facdbView: read('ji82-xba5.view.json'),
  metersRows: read('nyc-meters-offstreet.rows.json'),
  metersView: read('693u-uax6.view.json'),
};

export function rowsWithout(body: Uint8Array, keep: (row: Record<string, unknown>) => boolean): Uint8Array {
  const rows = JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>[];
  return new TextEncoder().encode(JSON.stringify(rows.filter(keep)));
}

/** An UpstreamHttp that answers the two NYC datasets from fixtures, and records each request. */
export function fixtureHttp(overrides: Partial<Record<keyof typeof fixtures, Uint8Array>> = {}) {
  const bodies = { ...fixtures, ...overrides };
  const requests: Request[] = [];
  const routes: Record<string, Uint8Array> = {
    '/resource/ji82-xba5.json': bodies.facdbRows,
    '/api/views/ji82-xba5.json': bodies.facdbView,
    '/resource/693u-uax6.json': bodies.metersRows,
    '/api/views/693u-uax6.json': bodies.metersView,
  };
  const http = new UpstreamHttp({
    socrataAppToken: 'fixture-token',
    fetch: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      const body = routes[new URL(request.url).pathname];
      return body
        ? new Response(new Uint8Array(body), { headers: { 'content-type': 'application/json;charset=utf-8' } })
        : new Response('{}', { status: 404 });
    },
  });
  return { http, requests };
}
