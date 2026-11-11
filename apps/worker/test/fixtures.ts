// The sources' real responses, saved on 2026-11-03 with the adapters' own queries (specs/06-sources.md).
// For the ArcGIS layers, the item, service, and layer responses are trimmed to the fields the adapters
// read; the query responses, which are what a run stores, are as received. Two exceptions, saved on 2026-11-06:
// the Hudson parcel layer's neighbours are one response holding every neighbour, which the fake upstream filters
// to each query's blocks; and Hoboken's page is saved as a run stores it, with its email addresses removed.
// Essex's and Bergen's parcel responses were saved on 2026-11-07, the same way as Hudson's. Bayonne's ordinance (a PDF) was saved on
// 2026-11-07, as received; Union City's and Harrison's pages on 2026-11-07, as a
// run stores them (no email addresses). Westwood's and Oradell's pages were saved on 2026-11-07 as a run stores them.
// The rest of NJ's parcel responses (ADR-0020) were saved on 2026-11-10, gzipped in one file: each county's candidates
// response, and one neighbours response holding every neighbour, filtered to each query's blocks as for Hudson.
// New York State's (ADR-0022) were saved on 2026-11-11: the Thruway's rows as received, the parcel layer's query as
// received (gzipped), and the dataset's and service's metadata trimmed to the fields the adapters read.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
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
  bergenCandidates: read('nj-parcels-bergen.candidates.json'),
  bergenNeighbours: read('nj-parcels-bergen.neighbours.json'),
  restOfNj: new Uint8Array(gunzipSync(read('nj-parcels-rest-of-nj.json.gz'))),
  thruwayRows: read('nys-thruway.rows.json'),
  thruwayView: read('nys-thruway.view.json'),
  nysParcelsService: read('nys-parcels.service.json'),
  nysParcelsQuery: new Uint8Array(gunzipSync(read('nys-parcels.query.json.gz'))),
  wnyFacilities: read('wny.facilities.html'),
  hobokenGarages: read('hoboken.garages.html'),
  bayonneOrdinance: read('bayonne.o-16-64.pdf'),
  ucpaParking: read('ucpa.parking.html'),
  harrisonParking: read('harrison.parking-permits.html'),
  bloomfieldMeters: read('bloomfield.pay-display-go.html'),
  southOrangeMeters: read('south-orange.meters.html'),
  nutleyParking: read('nutley.parking.html'),
  veronaParking: read('verona.municipal-parking.html'),
  westwoodCustomer: read('westwood.downtown-customer-parking.html'),
  westwoodUtility: read('westwood.parking-utility.html'),
  oradellParking: read('oradell.municipal-parking.html'),
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
  '/408/Downtown-Customer-Parking': { 'content-type': 'text/html; charset=utf-8' },
  '/399/Parking-Utility': { 'content-type': 'text/html; charset=utf-8' },
  // Oradell's Last-Modified is the time of the request, so the adapter ignores it.
  '/1410/Municipal-Parking': { 'content-type': 'text/html; charset=utf-8', 'last-modified': 'Sat, 07 Nov 2026 12:21:48 GMT' },
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
    '/408/Downtown-Customer-Parking': bodies.westwoodCustomer,
    '/399/Parking-Utility': bodies.westwoodUtility,
    '/1410/Municipal-Parking': bodies.oradellParking,
    '/resource/nvxe-b625.json': bodies.thruwayRows,
    '/api/views/nvxe-b625.json': bodies.thruwayView,
    '/arcgis/rest/services/NYS_Tax_Parcels_Public/MapServer': bodies.nysParcelsService,
    '/arcgis/rest/services/NYS_Tax_Parcels_Public/MapServer/1/query': bodies.nysParcelsQuery,
  };
  // The parcel layer's queries share a path; the candidates ask for class 15C, the neighbours for all of 15.
  // Parsed only when a test asks for the rest of NJ: it's 2.5 MB.
  let restOfNjParsed: { candidates: Record<string, unknown>; neighbours: Uint8Array } | undefined;
  const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
  const restOfNj = () => {
    if (!restOfNjParsed) {
      const parsed = JSON.parse(new TextDecoder().decode(bodies.restOfNj)) as { candidates: Record<string, unknown>; neighbours: unknown };
      restOfNjParsed = { candidates: parsed.candidates, neighbours: encode(parsed.neighbours) };
    }
    return restOfNjParsed;
  };
  const parcelsQuery = (url: URL) => {
    const where = url.searchParams.get('where') ?? '';
    // Each county by its name in the candidates' query, or its municipality codes (09xx Hudson, 07xx Essex, 02xx Bergen)
    // in the neighbours'; anything else is the rest of NJ.
    const named = /COUNTY='([A-Z ]+)'/.exec(where)?.[1];
    const prefix = /PCL_MUN='(\d\d)/.exec(where)?.[1];
    const county = named === 'ESSEX' || prefix === '07' ? 'essex' : named === 'BERGEN' || prefix === '02' ? 'bergen'
      : named === 'HUDSON' || prefix === '09' ? 'hudson' : 'rest';
    if (where.includes("PROP_CLASS='15C'")) {
      if (county === 'rest') return encode(restOfNj().candidates[named ?? ''] ?? { features: [] });
      return { hudson: bodies.parcelsCandidates, essex: bodies.essexCandidates, bergen: bodies.bergenCandidates }[county];
    }
    if (county === 'rest') return neighboursFor(restOfNj().neighbours, where);
    return neighboursFor({ hudson: bodies.parcelsNeighbours, essex: bodies.essexNeighbours, bergen: bodies.bergenNeighbours }[county], where);
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
