// S2-3: fetching one hosted ArcGIS layer (specs/06-sources.md, "New Jersey adapters"). The item ID is the
// stable part: it gives the service URL, whose name can change (NJ Transit's has a date in it). The query
// response is stored exactly as received (ING-2), so it's one query; a response that says it was cut short
// fails instead of being kept in part, like the Socrata row limit.
import { IngestionError } from '../errors.ts';
import type { UpstreamHttp } from '../http.ts';
import type { FetchedData, StoredSnapshot } from './types.ts';

export const ARCGIS_ITEMS = 'https://www.arcgis.com/sharing/rest/content/items';

export function arcgisItemPage(itemId: string): string {
  return `https://www.arcgis.com/home/item.html?id=${itemId}`;
}

export interface ArcgisLayerQuery {
  itemId: string;
  /** Only the fields the adapter uses, so nothing else (such as contact names) is ever stored. */
  outFields: readonly string[];
  orderBy: string;
  /** `centroid` for polygon layers (the centre of each outline), `point` for point layers. */
  geometry: 'centroid' | 'point';
}

export async function fetchArcgisLayer(http: UpstreamHttp, query: ArcgisLayerQuery): Promise<FetchedData> {
  const { layerUrl, editedAt } = await resolveArcgisLayer(http, query.itemId);
  const rows = await queryArcgisLayer(http, layerUrl, {
    where: '1=1',
    outFields: query.outFields.join(','),
    orderByFields: query.orderBy,
    returnGeometry: String(query.geometry === 'point'),
    ...(query.geometry === 'centroid' ? { returnCentroid: 'true' } : {}),
  });
  return { body: rows.body, contentType: rows.contentType, upstreamUpdatedAt: editedAt };
}

/** The item's feature service, which must have exactly one layer, and that layer's "data last edited" time. */
export async function resolveArcgisLayer(http: UpstreamHttp, itemId: string): Promise<{ layerUrl: string; editedAt: Date | null }> {
  const item = await getJson(http, `${ARCGIS_ITEMS}/${itemId}?f=json`);
  const serviceUrl = item.url;
  if (typeof serviceUrl !== 'string' || !/^https:\/\/[^/]+\/.+\/FeatureServer$/.test(serviceUrl)) {
    throw new IngestionError('normalize.unexpected_format', `item ${itemId} has no feature service URL`);
  }
  const service = await getJson(http, `${serviceUrl}?f=json`);
  const layers = service.layers;
  if (!Array.isArray(layers) || layers.length !== 1 || typeof (layers[0] as { id?: unknown }).id !== 'number') {
    throw new IngestionError('normalize.unexpected_format', `item ${itemId}'s service doesn't have exactly one layer`);
  }
  const layerUrl = `${serviceUrl}/${(layers[0] as { id: number }).id}`;
  const layer = await getJson(http, `${layerUrl}?f=json`);
  const editedAt = (layer.editingInfo as { dataLastEditDate?: unknown } | undefined)?.dataLastEditDate;
  return { layerUrl, editedAt: typeof editedAt === 'number' && Number.isFinite(editedAt) ? new Date(editedAt) : null };
}

/**
 * One query, in WGS 84 and JSON, returned exactly as received. Fails on an error answer, and on a response
 * cut short at the layer's record limit rather than keep part of it.
 */
export async function queryArcgisLayer(http: UpstreamHttp, layerUrl: string, params: Record<string, string>) {
  const url = new URL(`${layerUrl}/query`);
  for (const [name, value] of Object.entries({ ...params, outSR: '4326', f: 'json' })) url.searchParams.set(name, value);
  const rows = await http.get(url.toString());
  const parsed = parseJson(rows.body);
  if ('error' in parsed) {
    throw new IngestionError('upstream.http_status', `${new URL(layerUrl).host} answered the query with an error`);
  }
  if (parsed.exceededTransferLimit === true) {
    throw new IngestionError('upstream.too_large', `${new URL(layerUrl).host} has more records than one query returns`);
  }
  return rows;
}

export interface Feature {
  attributes: Record<string, unknown>;
  /** WGS 84: the outline's centroid, or the point itself. */
  point: { lat: number; lng: number } | null;
}

/** The features of a query response, each with its centroid or point. */
export function parseFeatures(body: Uint8Array | StoredSnapshot['body'] | string): Feature[] {
  const features = parseJson(body).features;
  if (!Array.isArray(features)) {
    throw new IngestionError('normalize.unexpected_format', 'response has no features');
  }
  return features.map((feature: unknown) => {
    const { attributes, centroid, geometry } = (feature ?? {}) as { attributes?: unknown; centroid?: unknown; geometry?: unknown };
    if (typeof attributes !== 'object' || attributes === null) {
      throw new IngestionError('normalize.unexpected_format', 'a feature has no attributes');
    }
    return { attributes: attributes as Record<string, unknown>, point: toPoint(centroid ?? geometry) };
  });
}

function toPoint(value: unknown): Feature['point'] {
  const { x, y } = (value ?? {}) as { x?: unknown; y?: unknown };
  return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y) ? { lat: y, lng: x } : null;
}

/** A text attribute, trimmed, with ArcGIS's "<Null>" placeholder treated as empty. */
export function attributeText(attributes: Record<string, unknown>, field: string): string | null {
  const value = attributes[field];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed === '' || trimmed === '<Null>' ? null : trimmed;
}

export function attributeNumber(attributes: Record<string, unknown>, field: string): number | null {
  const value = attributes[field];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function getJson(http: UpstreamHttp, url: string): Promise<Record<string, unknown>> {
  const parsed = parseJson((await http.get(url)).body);
  if ('error' in parsed) {
    throw new IngestionError('upstream.http_status', `${new URL(url).host} answered with an error`);
  }
  return parsed;
}

export function parseJson(body: Uint8Array | string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(typeof body === 'string' ? body : new TextDecoder().decode(body));
  } catch {
    throw new IngestionError('normalize.unexpected_format', 'response is not JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new IngestionError('normalize.unexpected_format', 'response is not a JSON object');
  }
  return parsed as Record<string, unknown>;
}
