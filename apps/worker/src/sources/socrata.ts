// Fetching from a Socrata (SODA) portal: one rows request plus the dataset's metadata for its
// "data updated" time. The rows response is stored exactly as received (ING-2), so it's one request
// with a high limit; a result that reaches the limit fails instead of being silently cut short.
import { IngestionError } from '../errors.ts';
import type { UpstreamHttp } from '../http.ts';
import type { FetchedData, StoredSnapshot } from './types.ts';

export const SOCRATA_LIMIT = 50_000;

export interface SocrataQuery {
  domain: string;
  datasetId: string;
  /** SoQL clauses: $select, $where, $order. */
  params: Record<string, string>;
}

export function socrataRowsUrl({ domain, datasetId, params }: SocrataQuery): string {
  const url = new URL(`https://${domain}/resource/${datasetId}.json`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  url.searchParams.set('$limit', String(SOCRATA_LIMIT));
  return url.toString();
}

export async function fetchSocrata(http: UpstreamHttp, query: SocrataQuery): Promise<FetchedData> {
  const rows = await http.get(socrataRowsUrl(query), { socrata: true });
  if (parseRows(rows.body).length >= SOCRATA_LIMIT) {
    throw new IngestionError('upstream.too_large', `${query.datasetId} returned ${SOCRATA_LIMIT} rows or more`);
  }
  const metadata = await http.get(`https://${query.domain}/api/views/${query.datasetId}.json`, { socrata: true });
  return { body: rows.body, contentType: rows.contentType, upstreamUpdatedAt: rowsUpdatedAt(metadata.body) };
}

/** The rows of a SODA JSON response: an array of objects whose values are strings (or nested objects). */
export function parseRows(body: Uint8Array | StoredSnapshot['body']): Record<string, unknown>[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new IngestionError('normalize.unexpected_format', 'response is not JSON');
  }
  if (!Array.isArray(parsed) || !parsed.every((row) => typeof row === 'object' && row !== null && !Array.isArray(row))) {
    throw new IngestionError('normalize.unexpected_format', 'response is not an array of rows');
  }
  return parsed as Record<string, unknown>[];
}

function rowsUpdatedAt(body: Uint8Array): Date | null {
  try {
    const seconds = (JSON.parse(new TextDecoder().decode(body)) as { rowsUpdatedAt?: unknown }).rowsUpdatedAt;
    return typeof seconds === 'number' && Number.isFinite(seconds) ? new Date(seconds * 1000) : null;
  } catch {
    return null;
  }
}

export function text(row: Record<string, unknown>, field: string): string | null {
  const value = row[field];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

export function number(row: Record<string, unknown>, field: string): number | null {
  const value = text(row, field);
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
