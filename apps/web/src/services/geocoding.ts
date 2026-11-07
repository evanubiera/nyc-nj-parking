// WEB-11, ADR-0013: suggestions for what someone types in address search, and the point to search from.
// Towns and neighbourhoods come from a list in the app, so typing a town sends nothing anywhere. Addresses go
// straight from the browser to the state's geocoder (NYC GeoSearch or the State's NJ_Geocode), never through
// our API. Nothing typed is stored, logged, or put in a URL of ours (PRIV-1, PRIV-5).
import { geocoderUrls } from '../config.ts';
import { properCaseAddress } from '../utils/addressCase.ts';
import { roundPoint, type Point } from '../utils/location.ts';

export interface Suggestion {
  id: string;
  /** The text to show: as the place list or geocoder writes it, with an address in capitals put in proper case. */
  label: string;
  kind: 'place' | 'address';
  /** For a place, a neighbourhood's borough or a town's county; it tells same-named places apart. */
  area?: string;
  state: 'NJ' | 'NY';
  /** Known now for places and NYC addresses; an NJ address is looked up when chosen. */
  point?: Point;
  /** NJ_Geocode's key for looking up a chosen suggestion. */
  magicKey?: string;
}

interface Place {
  name: string;
  aliases: string[];
  state: 'NJ' | 'NY';
  area: string;
  lat: number;
  lng: number;
  population: number | null;
}

export const MIN_ADDRESS_LENGTH = 3;
const MAX_PLACES = 5;
const MAX_ADDRESSES = 5;

let places: Promise<Place[]> | undefined;
/** The list is large, so it loads the first time someone types, in its own file. */
function loadPlaces(): Promise<Place[]> {
  places ??= import('../data/places.json').then((module) => (module.default as { places: Place[] }).places);
  return places;
}

const normal = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// The state names may be followed by a ZIP code, as in a chosen suggestion: "…, Jersey City, NJ, 07302".
const NJ_WORDS = /\b(nj|new jersey)\b[\s,\d-]*$/i;
const NY_WORDS = /\b(ny|new york|nyc|manhattan|brooklyn|queens|bronx|staten island)\b[\s,\d-]*$/i;

/** "Hoboken, NJ" → { name: "hoboken", state: "NJ" }; "Astoria" → { name: "astoria" }. */
function parse(text: string): { name: string; state?: 'NJ' | 'NY' } {
  const match = /^(.*?)[,\s]+(nj|new jersey|ny|new york)\s*$/i.exec(text.trim());
  if (!match) return { name: normal(text) };
  return { name: normal(match[1]!), state: /^n(ew )?j/i.test(match[2]!) ? 'NJ' : 'NY' };
}

/** Towns and neighbourhoods whose name or another name starts with, or contains, what was typed. */
export async function suggestPlaces(text: string): Promise<Suggestion[]> {
  const { name, state } = parse(text);
  if (name.length < 2) return [];
  const scored: { place: Place; score: number }[] = [];
  for (const place of await loadPlaces()) {
    if (state && place.state !== state) continue;
    const names = [place.name, ...place.aliases].map(normal);
    const score = names.includes(name) ? 0 : names.some((n) => n.startsWith(name)) ? 1 : names.some((n) => n.includes(` ${name}`)) ? 2 : -1;
    if (score >= 0) scored.push({ place, score });
  }
  scored.sort((a, b) => a.score - b.score || (b.place.population ?? 0) - (a.place.population ?? 0) || a.place.name.localeCompare(b.place.name));
  return scored.slice(0, MAX_PLACES).map(({ place }) => ({
    id: `place:${place.state}:${place.area}:${place.name}`,
    label: place.name,
    kind: 'place',
    area: place.area,
    state: place.state,
    point: { lat: place.lat, lng: place.lng },
  }));
}

/** Which state's geocoder to ask: the one the text names, or both. */
export function statesFor(text: string, matchedPlaces: readonly Suggestion[]): ('NJ' | 'NY')[] {
  if (NJ_WORDS.test(text)) return ['NJ'];
  if (NY_WORDS.test(text)) return ['NY'];
  const states = new Set(matchedPlaces.map((place) => place.state));
  return states.size === 1 ? [...states] : ['NY', 'NJ'];
}

async function nycAddresses(text: string, signal?: AbortSignal): Promise<Suggestion[]> {
  const url = `${geocoderUrls.nyc}/autocomplete?${new URLSearchParams({ text })}`;
  const response = await fetch(url, { signal });
  if (!response.ok) return [];
  const data = (await response.json()) as { features?: { properties?: { label?: string; gid?: string }; geometry?: { coordinates?: number[] } }[] };
  return (data.features ?? []).slice(0, MAX_ADDRESSES).flatMap((feature, index) => {
    const [lng, lat] = feature.geometry?.coordinates ?? [];
    const raw = feature.properties?.label?.replace(/, USA$/, '');
    const label = raw && properCaseAddress(raw);
    if (!label || typeof lat !== 'number' || typeof lng !== 'number') return [];
    return [{ id: `ny:${feature.properties?.gid ?? index}`, label, kind: 'address', state: 'NY', point: { lat, lng } } satisfies Suggestion];
  });
}

async function njAddresses(text: string, signal?: AbortSignal): Promise<Suggestion[]> {
  const url = `${geocoderUrls.nj}/suggest?${new URLSearchParams({ text, maxSuggestions: String(MAX_ADDRESSES), f: 'json' })}`;
  const response = await fetch(url, { signal });
  if (!response.ok) return [];
  const data = (await response.json()) as { suggestions?: { text?: string; magicKey?: string }[] };
  return (data.suggestions ?? []).flatMap((suggestion) =>
    suggestion.text && suggestion.magicKey
      ? [{ id: `nj:${suggestion.magicKey}`, label: properCaseAddress(suggestion.text), kind: 'address', state: 'NJ', magicKey: suggestion.magicKey } satisfies Suggestion]
      : [],
  );
}

/**
 * WEB-11: places first, then addresses. Text that starts with a number is an address and goes to the geocoder
 * for the state it names (or both); anything else stays in the browser. A geocoder that fails gives no
 * addresses, and the places still show.
 */
export async function suggest(text: string, signal?: AbortSignal): Promise<Suggestion[]> {
  const trimmed = text.trim();
  if (trimmed.length < MIN_ADDRESS_LENGTH) return [];
  const matchedPlaces = /^\d/.test(trimmed) ? [] : await suggestPlaces(trimmed);
  if (!/^\d+\w*\s+\S/.test(trimmed)) return matchedPlaces;
  // "174 Newark Ave, Jersey City" names a town after the first comma; it says which state to ask.
  const town = trimmed.split(',').slice(1).join(',');
  const states = statesFor(trimmed, town ? await suggestPlaces(town) : []);
  const lookups = states.map((state) => (state === 'NY' ? nycAddresses(trimmed, signal) : njAddresses(trimmed, signal)).catch(() => []));
  return [...matchedPlaces, ...(await Promise.all(lookups)).flat()];
}

/** The point to search from, rounded (PRIV-3). An NJ address is looked up by its key. */
export async function pointFor(suggestion: Suggestion, signal?: AbortSignal): Promise<Point | null> {
  if (suggestion.point) return roundPoint(suggestion.point);
  if (!suggestion.magicKey) return null;
  const url = `${geocoderUrls.nj}/findAddressCandidates?${new URLSearchParams({
    SingleLine: suggestion.label,
    magicKey: suggestion.magicKey,
    outSR: '4326',
    maxLocations: '1',
    f: 'json',
  })}`;
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return null;
    const data = (await response.json()) as { candidates?: { location?: { x?: number; y?: number } }[] };
    const { x, y } = data.candidates?.[0]?.location ?? {};
    return typeof x === 'number' && typeof y === 'number' ? roundPoint({ lat: y, lng: x }) : null;
  } catch {
    return null;
  }
}
