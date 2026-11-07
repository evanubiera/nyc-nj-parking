// The sources' real responses, saved on 2026-11-03 with the adapters' own queries (specs/06-sources.md).
// For the ArcGIS layers, the item, service, and layer responses are trimmed to the fields the adapters
// read; the query responses, which are what a run stores, are as received. Two exceptions, saved on 2026-11-06:
// the Hudson parcel layer's neighbours are one response holding every neighbour, which the fake upstream filters
// to each query's blocks; and Hoboken's page is saved as a run stores it, with its email addresses removed.
// Essex's parcel responses were saved on 2026-11-07, the same way as Hudson's. Bayonne's ordinance (a PDF) was saved on
// 2026-11-07, as received; Union City's and Harrison's pages on 2026-11-07, as a
// run stores them (no email addresses).
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
  parcelsCandidates: read('nj-parcels-hudson.candidates.json'),
  parcelsNeighbours: read('nj-parcels-hudson.neighbours.json'),
  essexCandidates: read('nj-parcels-essex.candidates.json'),
  essexNeighbours: read('nj-parcels-essex.neighbours.json'),
  wnyFacilities: read('wny.facilities.html'),
  hobokenGarages: read('hoboken.garages.html'),
  bayonneOrdinance: read('bayonne.o-16-64.pdf'),
  ucpaParking: read('ucpa.parking.html'),
  harrisonParking: read('harrison.parking-permits.html'),
  bloomfieldMeters: read('bloomfield.pay-display-go.html'),
  southOrangeMeters: read('south-orange.meters.html'),
  nutleyParking: read('nutley.parking.html'),
  veronaParking: read('verona.municipal-parking.html'),
};

export const NJT_SERVICE_PATH = '/M0t0HPE53pFK525U/arcgis/rest/services/ParkingLotDB_20260320_Sync_view/FeatureServer';
export const NJDOT_SERVICE_PATH = '/HggmsDF7UJsNN1FK/arcgis/rest/services/New_Jersey_DOT_Park_Ride/FeatureServer';
export const PARCELS_SERVICE_PATH = '/XVOqAjTOJ5P6ngMu/arcgis/rest/services/Parcels_Composite_NJ_WM/FeatureServer';

const PAGE_HEADERS: Record<string, Record<string, string>> = {
  '/pages/parking-services/facilities/': { 'content-type': 'text/html; charset=UTF-8', 'last-modified': 'Fri, 06 Nov 2026 23:10:53 GMT' },
  '/resources/municipal-garages': { 'content-type': 'text/html; charset=utf-8', 'last-modified': 'Fri, 06 Nov 2026 22:16:52 GMT' },
  '/_Content/pdf/ordinances/O-16-64.pdf': { 'content-type': 'application/pdf', 'last-modified': 'Fri, 15 Jan 2021 16:54:38 GMT' },
  // Neither page sends a Last-Modified header (checked 2026-11-07).
  '/Parking': { 'content-type': 'text/html; charset=utf-8' },
  '/223/Parking-Permits': { 'content-type': 'text/html; charset=utf-8' },
  '/pay-display-go/': { 'content-type': 'text/html; charset=UTF-8', 'last-modified': 'Thu, 05 Nov 2026 17:20:43 GMT' },
  '/189/Meters-Pay-Stations': { 'content-type': 'text/html; charset=utf-8' },
  '/parking': { 'content-type': 'text/html; charset=utf-8' },
  '/MunicipalParking': { 'content-type': 'text/html; charset=utf-8' },
};

/** The neighbours response for one query: the saved neighbours on the blocks its `where` names, such as
 * `(PCL_MUN='0906' AND PCLBLOCK IN ('11401','14102'))`. */
export function neighboursFor(body: Uint8Array, where: string): Uint8Array {
  const wanted = new Set(
    [...where.matchAll(/PCL_MUN='(\d+)' AND PCLBLOCK IN \(([^)]*)\)/g)].flatMap(([, town, blocks]) =>
      [...blocks!.matchAll(/'([^']*)'/g)].map(([, block]) => `${town}:${block}`)),
  );
  const parsed = JSON.parse(new TextDecoder().decode(body)) as { features: { attributes: Record<string, string> }[] };
  parsed.features = parsed.features.filter(({ attributes }) => wanted.has(`${attributes.PCL_MUN?.trim()}:${attributes.PCLBLOCK?.trim()}`));
  return new TextEncoder().encode(JSON.stringify(parsed));
}

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
    '/resources/municipal-garages': bodies.hobokenGarages,
    '/_Content/pdf/ordinances/O-16-64.pdf': bodies.bayonneOrdinance,
    '/Parking': bodies.ucpaParking,
    '/223/Parking-Permits': bodies.harrisonParking,
    '/pay-display-go/': bodies.bloomfieldMeters,
    '/189/Meters-Pay-Stations': bodies.southOrangeMeters,
    '/parking': bodies.nutleyParking,
    '/MunicipalParking': bodies.veronaParking,
  };
  // The parcel layer's queries share a path; the candidates ask for class 15C, the neighbours for all of 15.
  const parcelsQuery = (url: URL) => {
    const where = url.searchParams.get('where') ?? '';
    const essex = where.includes("COUNTY='ESSEX'") || where.includes("PCL_MUN='07");
    if (where.includes("PROP_CLASS='15C'")) return essex ? bodies.essexCandidates : bodies.parcelsCandidates;
    return neighboursFor(essex ? bodies.essexNeighbours : bodies.parcelsNeighbours, where);
  };
  const http = new UpstreamHttp({
    socrataAppToken: 'fixture-token',
    fetch: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      const url = new URL(request.url);
      const body = url.pathname === `${PARCELS_SERVICE_PATH}/0/query` ? parcelsQuery(url) : routes[url.pathname];
      return body
        ? new Response(new Uint8Array(body), {
            headers: PAGE_HEADERS[url.pathname] ?? { 'content-type': 'application/json;charset=utf-8' },
          })
        : new Response('{}', { status: 404 });
    },
  });
  return { http, requests };
}
