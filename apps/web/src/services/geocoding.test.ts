import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { geocoderUrls } from '../config.ts';
import { pointFor, suggest, suggestPlaces } from './geocoding.ts';

const requests: URL[] = [];

function geocoders(answers: { ny?: unknown; nj?: unknown; njPoint?: unknown; fail?: boolean } = {}) {
  vi.stubGlobal('fetch', async (input: string) => {
    const url = new URL(input);
    requests.push(url);
    if (answers.fail) throw new TypeError('Failed to fetch');
    if (url.href.startsWith(`${geocoderUrls.nyc}/autocomplete`)) return Response.json(answers.ny ?? { features: [] });
    if (url.href.startsWith(`${geocoderUrls.nj}/suggest`)) return Response.json(answers.nj ?? { suggestions: [] });
    if (url.href.startsWith(`${geocoderUrls.nj}/findAddressCandidates`)) return Response.json(answers.njPoint ?? { candidates: [] });
    return new Response('{}', { status: 404 });
  });
}

const NYC_120_BROADWAY = {
  features: [{ properties: { label: '120 BROADWAY, New York, NY, USA', gid: 'nycpad:address:1' }, geometry: { coordinates: [-74.010542, 40.708233] } }],
};
const NJ_174_NEWARK = { suggestions: [{ text: '174 Newark Avenue, Jersey City, NJ, 07302', magicKey: 'key-174' }] };

beforeEach(() => {
  requests.length = 0;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('address search suggestions (WEB-11, ADR-0013)', () => {
  it('WEB-11 suggests a town from the built-in list, and sends nothing anywhere (PRIV-5)', async () => {
    geocoders();

    const hoboken = await suggest('Hoboken, NJ');
    const astoria = await suggest('Astoria, NY');

    expect(hoboken[0]).toMatchObject({ label: 'Hoboken City', kind: 'place', area: 'Hudson County', state: 'NJ' });
    expect(hoboken[0]!.point).toEqual({ lat: 40.74534, lng: -74.03209 });
    expect(astoria[0]).toMatchObject({ label: 'Astoria', area: 'Queens', state: 'NY' });
    expect(requests).toHaveLength(0);
  });

  it('WEB-11 tells same-named towns apart by county', async () => {
    const washingtons = await suggestPlaces('Washington, NJ');

    expect(washingtons.map((place) => place.area)).toContain('Morris County');
    expect(new Set(washingtons.map((place) => `${place.label}|${place.area}`)).size).toBe(washingtons.length);
  });

  it('PRIV-5 asks only New Jersey\'s geocoder for an address in a New Jersey town, and never our API', async () => {
    geocoders({ nj: NJ_174_NEWARK });

    const results = await suggest('174 Newark Ave, Jersey City');

    expect(results).toEqual([expect.objectContaining({ label: '174 Newark Avenue, Jersey City, NJ, 07302', kind: 'address', state: 'NJ', magicKey: 'key-174' })]);
    expect(requests.map((url) => url.pathname)).toEqual([new URL(`${geocoderUrls.nj}/suggest`).pathname]);
    expect(requests[0]!.searchParams.get('text')).toBe('174 Newark Ave, Jersey City');
    expect(requests.every((url) => !url.pathname.startsWith('/api'))).toBe(true);
  });

  it('WEB-11 asks NYC GeoSearch for an address that names New York, and shows it in proper case', async () => {
    geocoders({ ny: NYC_120_BROADWAY });

    const results = await suggest('120 Broadway, New York, NY');

    expect(results).toEqual([expect.objectContaining({ label: '120 Broadway, New York, NY', state: 'NY', point: { lat: 40.708233, lng: -74.010542 } })]);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.href.startsWith(geocoderUrls.nyc)).toBe(true);
  });

  it('PRIV-5 reads the state even with a ZIP code after it, as in a chosen suggestion', async () => {
    geocoders({ nj: NJ_174_NEWARK });

    await suggest('174 Newark Avenue, Jersey City, NJ, 07302');

    expect(requests.map((url) => url.host)).toEqual([new URL(geocoderUrls.nj).host]);
  });

  it('WEB-11 asks both geocoders when an address names neither state', async () => {
    geocoders({ ny: NYC_120_BROADWAY, nj: NJ_174_NEWARK });

    const results = await suggest('120 Broadway');

    expect(requests.map((url) => url.host).sort()).toEqual([new URL(geocoderUrls.nj).host, new URL(geocoderUrls.nyc).host].sort());
    expect(results.map((result) => result.state).sort()).toEqual(['NJ', 'NY']);
  });

  it('waits for three characters before suggesting anything', async () => {
    geocoders();

    expect(await suggest('Ho')).toEqual([]);
    expect(requests).toHaveLength(0);
  });

  it('still suggests towns when a geocoder fails, and gives no addresses', async () => {
    geocoders({ fail: true });

    expect(await suggest('12 Washington St, Hoboken')).toEqual([]);
    expect((await suggest('Hoboken'))[0]?.label).toBe('Hoboken City');
  });

  it('PRIV-3 rounds the chosen point, and looks an NJ address up by its key', async () => {
    geocoders({ njPoint: { candidates: [{ location: { x: -74.045042, y: 40.721587 } }] } });

    const point = await pointFor({ id: 'nj:key-174', label: '174 Newark Avenue, Jersey City, NJ, 07302', kind: 'address', state: 'NJ', magicKey: 'key-174' });
    const lookup = requests[0]!;

    expect(point).toEqual({ lat: 40.722, lng: -74.045 });
    expect(lookup.searchParams.get('magicKey')).toBe('key-174');
    expect(await pointFor({ id: 'ny:1', label: '120 BROADWAY', kind: 'address', state: 'NY', point: { lat: 40.708233, lng: -74.010542 } })).toEqual({ lat: 40.708, lng: -74.011 });
  });

  it('gives no point when the NJ lookup finds nothing', async () => {
    geocoders({ njPoint: { candidates: [] } });

    expect(await pointFor({ id: 'nj:x', label: 'Nowhere', kind: 'address', state: 'NJ', magicKey: 'x' })).toBeNull();
  });
});
