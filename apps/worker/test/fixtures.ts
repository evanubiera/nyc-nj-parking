// The sources' real responses, saved on 2026-11-03 with the adapters' own queries (specs/06-sources.md).
// For the ArcGIS layers, the item, service, and layer responses are trimmed to the fields the adapters
// read; the query responses, which are what a run stores, are as received.
import { readFileSync } from 'node:fs';
import { UpstreamHttp } from '../src/http.ts';

const read = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

export const fixtures = {
  facdbRows: read('nyc-facdb-dot.rows.json'),
  facdbView: read('ji82-xba5.view.json'),
  metersRows: read('nyc-meters-offstreet.rows.json'),
  metersView: read('693u-uax6.view.json'),
  njtItem: read('njt.item.json'),
  njtService: read('njt.service.json'),
  njtLayer: read('njt.layer.json'),
  njtQuery: read('njt.query.json'),
  njdotItem: read('njdot.item.json'),
  njdotService: read('njdot.service.json'),
  njdotLayer: read('njdot.layer.json'),
  njdotQuery: read('njdot.query.json'),
  jcLotsRecords: read('jc-lots.records.json'),
  jcLotsDataset: read('jc-lots.dataset.json'),
  parcelsItem: read('nj-parcels.item.json'),
  parcelsService: read('nj-parcels.service.json'),
  parcelsLayer: read('nj-parcels.layer.json'),
  parcelsCandidates: read('nj-parcels.candidates.json'),
  parcelsNeighbours: read('nj-parcels.neighbours.json'),
  wnyFacilities: read('wny.facilities.html'),
};

export const NJT_SERVICE_PATH = '/M0t0HPE53pFK525U/arcgis/rest/services/ParkingLotDB_20260320_Sync_view/FeatureServer';
export const NJDOT_SERVICE_PATH = '/HggmsDF7UJsNN1FK/arcgis/rest/services/New_Jersey_DOT_Park_Ride/FeatureServer';
export const PARCELS_SERVICE_PATH = '/XVOqAjTOJ5P6ngMu/arcgis/rest/services/Parcels_Composite_NJ_WM/FeatureServer';

/** An ArcGIS query response with each feature's attributes changed by `edit`, or the feature dropped when it returns null. */
export function featuresEdited(
  body: Uint8Array,
  edit: (attributes: Record<string, unknown>) => Record<string, unknown> | null,
): Uint8Array {
  const parsed = JSON.parse(new TextDecoder().decode(body)) as { features: { attributes: Record<string, unknown> }[] };
  parsed.features = parsed.features.flatMap((feature) => {
    const attributes = edit({ ...feature.attributes });
    return attributes ? [{ ...feature, attributes }] : [];
  });
  return new TextEncoder().encode(JSON.stringify(parsed));
}

export function rowsWithout(body: Uint8Array, keep: (row: Record<string, unknown>) => boolean): Uint8Array {
  const rows = JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>[];
  return new TextEncoder().encode(JSON.stringify(rows.filter(keep)));
}

/** An UpstreamHttp that answers the NYC datasets and the NJ layers from fixtures, and records each request. */
export function fixtureHttp(overrides: Partial<Record<keyof typeof fixtures, Uint8Array>> = {}) {
  const bodies = { ...fixtures, ...overrides };
  const requests: Request[] = [];
  const routes: Record<string, Uint8Array> = {
    '/resource/ji82-xba5.json': bodies.facdbRows,
    '/api/views/ji82-xba5.json': bodies.facdbView,
    '/resource/693u-uax6.json': bodies.metersRows,
    '/api/views/693u-uax6.json': bodies.metersView,
    '/sharing/rest/content/items/2f311895a644453f8f679479187aa19e': bodies.njtItem,
    [NJT_SERVICE_PATH]: bodies.njtService,
    [`${NJT_SERVICE_PATH}/24`]: bodies.njtLayer,
    [`${NJT_SERVICE_PATH}/24/query`]: bodies.njtQuery,
    '/sharing/rest/content/items/ab33be6e4a51439c9ed179809b4d99cf': bodies.njdotItem,
    [NJDOT_SERVICE_PATH]: bodies.njdotService,
    [`${NJDOT_SERVICE_PATH}/0`]: bodies.njdotLayer,
    [`${NJDOT_SERVICE_PATH}/0/query`]: bodies.njdotQuery,
    '/api/explore/v2.1/catalog/datasets/municipal-parking-lots/records': bodies.jcLotsRecords,
    '/api/explore/v2.1/catalog/datasets/municipal-parking-lots': bodies.jcLotsDataset,
    '/sharing/rest/content/items/533599bbfbaa4748bf39faf1375a8a9c': bodies.parcelsItem,
    [PARCELS_SERVICE_PATH]: bodies.parcelsService,
    [`${PARCELS_SERVICE_PATH}/0`]: bodies.parcelsLayer,
    '/pages/parking-services/facilities/': bodies.wnyFacilities,
  };
  // The parcel layer's two queries share a path; the candidates ask for class 15C, the neighbours for all of 15.
  const parcelsQuery = (url: URL) => (url.searchParams.get('where')?.includes("PROP_CLASS='15C'") ? bodies.parcelsCandidates : bodies.parcelsNeighbours);
  const http = new UpstreamHttp({
    socrataAppToken: 'fixture-token',
    fetch: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      const url = new URL(request.url);
      const body = url.pathname === `${PARCELS_SERVICE_PATH}/0/query` ? parcelsQuery(url) : routes[url.pathname];
      return body
        ? new Response(new Uint8Array(body), {
            headers: url.pathname.endsWith('/facilities/')
              ? { 'content-type': 'text/html; charset=UTF-8', 'last-modified': 'Fri, 06 Nov 2026 23:10:53 GMT' }
              : { 'content-type': 'application/json;charset=utf-8' },
          })
        : new Response('{}', { status: 404 });
    },
  });
  return { http, requests };
}
