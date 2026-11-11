import { fireEvent, screen, within } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { en } from '../i18n/en.ts';
import { fetchAreaFacilities, fetchRecommendations } from '../services/recommendations.ts';
import { avenueM, delancey, montgomerySite, morristown2, sources } from '../test/facilities.ts';
import { maps, resetMaps } from '../test/maplibre.ts';
import { axeViolations, renderWithProviders } from '../test/render.tsx';
import { SearchPage } from './SearchPage.tsx';

vi.mock('../services/recommendations.ts', () => ({ fetchRecommendations: vi.fn(), fetchAreaFacilities: vi.fn() }));
vi.mock('../services/areas.ts', () => ({
  loadAreas: vi.fn(async () => [
    { id: 'nj-morris', name: 'Morris County', state: 'NJ', places: [
      { name: 'Madison Borough', point: { lat: 40.758, lng: -74.416 } },
      { name: 'Morristown Town', point: { lat: 40.797, lng: -74.481 } },
    ] },
    { id: 'ny-brooklyn', name: 'Brooklyn', state: 'NY', places: [{ name: 'Park Slope', point: { lat: 40.672, lng: -73.977 } }] },
  ]),
}));
vi.mock('../services/sources.ts', () => ({ fetchSources: vi.fn(async () => sources) }));
vi.mock('maplibre-gl', () => import('../test/maplibre.ts'));
vi.mock('../services/geocoding.ts', () => ({
  MIN_ADDRESS_LENGTH: 3,
  suggest: vi.fn(async () => [
    { id: 'place:NJ:Hudson County:Hoboken City', label: 'Hoboken City', kind: 'place', area: 'Hudson County', state: 'NJ', point: { lat: 40.74534, lng: -74.03209 } },
  ]),
  pointFor: vi.fn(async () => ({ lat: 40.745, lng: -74.032 })),
}));
const recommend = vi.mocked(fetchRecommendations);
const listArea = vi.mocked(fetchAreaFacilities);

function geolocationAnswering(answer: { lat: number; lng: number } | { error: number }): Geolocation {
  return {
    getCurrentPosition: vi.fn((success: PositionCallback, failure?: PositionErrorCallback | null) => {
      if ('error' in answer) {
        failure?.({ code: answer.error, message: '', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
      } else {
        success({ coords: { latitude: answer.lat, longitude: answer.lng, accuracy: 30 }, timestamp: Date.now() } as GeolocationPosition);
      }
    }),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  } as unknown as Geolocation;
}

/** WEB-13: a "Search by" choice. */
function searchBy(mode: 'place' | 'city' | 'area' | 'location') {
  fireEvent.change(screen.getByRole('combobox', { name: en['searchBy.label'] }), { target: { value: mode } });
}

/** WEB-4: "My current location" under "Search by", then "Share my location" in the dialog it opens. */
function shareLocation() {
  searchBy('location');
  fireEvent.click(within(screen.getByRole('dialog', { name: en['location.dialog.title'] })).getByRole('button', { name: en['location.dialog.share'] }));
}

beforeEach(() => {
  resetMaps();
  recommend.mockReset();
  recommend.mockResolvedValue({ status: 'ok', results: [avenueM, delancey] });
  listArea.mockReset();
});

describe('SearchPage', () => {
  it('WEB-4 asks for the location only after the person volunteers it in the dialog', async () => {
    const geolocation = geolocationAnswering({ lat: 40.71949, lng: -73.98751 });
    renderWithProviders(<SearchPage geolocation={geolocation} />);

    searchBy('location');

    const dialog = screen.getByRole('dialog', { name: en['location.dialog.title'] });
    expect(dialog).toHaveAccessibleDescription(en['location.dialog.body']);
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(await axeViolations(document.body)).toEqual([]);

    fireEvent.click(within(dialog).getByRole('button', { name: en['location.dialog.share'] }));

    expect(await screen.findByRole('heading', { name: '2 places within 2 km' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('WEB-4 asks nothing of the browser when the person says not now', () => {
    const geolocation = geolocationAnswering({ lat: 40.71949, lng: -73.98751 });
    renderWithProviders(<SearchPage geolocation={geolocation} />);

    searchBy('location');
    fireEvent.click(screen.getByRole('button', { name: en['location.dialog.cancel'] }));

    expect(screen.getByRole('combobox', { name: en['searchBy.label'] })).toHaveFocus();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(recommend).not.toHaveBeenCalled();
  });

  it('WEB-4 searches straight away the next time, once the person has shared in this visit', async () => {
    const geolocation = geolocationAnswering({ lat: 40.71949, lng: -73.98751 });
    renderWithProviders(<SearchPage geolocation={geolocation} />);
    shareLocation();
    await screen.findByRole('heading', { level: 2 });

    fireEvent.click(screen.getByRole('button', { name: en['search.useLocation'] }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it('WEB-13 searches by town or address unless the person chooses another way, the device\'s location among them', () => {
    renderWithProviders(<SearchPage />);

    const choice = screen.getByRole('combobox', { name: en['searchBy.label'] });
    expect(choice).toHaveValue('place');
    expect(within(choice).getAllByRole('option').map((option) => option.textContent)).toEqual([
      en['searchBy.place'], en['searchBy.city'], en['searchBy.area'], en['searchBy.location'],
    ]);
    expect(screen.getByRole('combobox', { name: en['address.label'] })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: en['search.useLocation'] })).toBeNull();
  });

  it('WEB-13 searches around a city chosen from its county, without asking for the device\'s location', async () => {
    const geolocation = geolocationAnswering({ lat: 40.6, lng: -73.9 });
    renderWithProviders(<SearchPage geolocation={geolocation} />);

    searchBy('city');
    const city = screen.getByRole('combobox', { name: en['city.label'] });
    expect(city).toBeDisabled();
    const county = await screen.findByRole('combobox', { name: en['area.label'] });
    await vi.waitFor(() => expect(county).toBeEnabled());
    fireEvent.change(county, { target: { value: 'nj-morris' } });
    fireEvent.change(city, { target: { value: 'Morristown Town' } });

    await vi.waitFor(() => expect(recommend).toHaveBeenCalledWith({ lat: 40.797, lng: -74.481 }, 2000));
    expect(await screen.findByText('Searching near Morristown Town')).toBeInTheDocument();
    expect(listArea).not.toHaveBeenCalled();
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('WEB-13 lists a whole county by town, with no radius and no distances, and sends no point', async () => {
    const inMadison = { ...morristown2, id: 'madison-lot', name: 'Madison Lot', address: { line: null, locality: 'Madison', region: 'NJ' as const }, distanceMeters: null };
    listArea.mockResolvedValue({ status: 'ok', results: [inMadison, { ...morristown2, distanceMeters: null }] });
    const { container } = renderWithProviders(<SearchPage />);

    searchBy('area');
    const county = await screen.findByRole('combobox', { name: en['area.label'] });
    await vi.waitFor(() => expect(county).toBeEnabled());
    fireEvent.change(county, { target: { value: 'nj-morris' } });

    expect(await screen.findByRole('heading', { level: 2, name: '2 places in Morris County' })).toBeInTheDocument();
    expect(listArea).toHaveBeenCalledWith('nj-morris');
    expect(recommend).not.toHaveBeenCalled();
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Madison', 'Morristown Town']);
    expect(screen.queryByRole('combobox', { name: en['search.radius.label'] })).toBeNull();
    expect(screen.getByText('Showing all of Morris County')).toBeInTheDocument();
    expect(screen.queryByText(/ m$| km$/)).toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('WEB-13 says when a county has nothing to show', async () => {
    listArea.mockResolvedValue({ status: 'ok', results: [] });
    renderWithProviders(<SearchPage />);

    searchBy('area');
    const county = await screen.findByRole('combobox', { name: en['area.label'] });
    await vi.waitFor(() => expect(county).toBeEnabled());
    fireEvent.change(county, { target: { value: 'ny-brooklyn' } });

    expect(await screen.findByText('No public parking found in Brooklyn.')).toBeInTheDocument();
  });

  it('PRIV-3 passes on only the rounded point', async () => {
    renderWithProviders(<SearchPage geolocation={geolocationAnswering({ lat: 40.71949, lng: -73.98751 })} />);

    shareLocation();
    await screen.findByRole('heading', { level: 2 });

    expect(recommend).toHaveBeenCalledWith({ lat: 40.719, lng: -73.988 }, 2000);
  });

  it('REC-2 searches again with the radius the person picks', async () => {
    renderWithProviders(<SearchPage geolocation={geolocationAnswering({ lat: 40.719, lng: -73.988 })} />);
    shareLocation();
    await screen.findByRole('heading', { level: 2 });

    fireEvent.change(screen.getByLabelText(en['search.radius.label']), { target: { value: '5000' } });

    expect(await screen.findByRole('heading', { name: '2 places within 5 km' })).toBeInTheDocument();
    expect(recommend).toHaveBeenLastCalledWith({ lat: 40.719, lng: -73.988 }, 5000);
  });

  it('WEB-4 explains what to do when location sharing is off and there is no map', async () => {
    const { container } = renderWithProviders(<SearchPage geolocation={geolocationAnswering({ error: 1 })} styleUrl={null} />);

    shareLocation();

    expect(await screen.findByText(en['location.deniedNoMap'])).toBeInTheDocument();
    expect(container.querySelector('.results-map')).toBeNull();
    expect(recommend).not.toHaveBeenCalled();
  });

  it('WEB-4 points to the map when location sharing is off', async () => {
    renderWithProviders(<SearchPage geolocation={geolocationAnswering({ error: 1 })} styleUrl="https://tiles.example.test/style" />);

    shareLocation();

    expect(await screen.findByText(en['location.denied'])).toBeInTheDocument();
  });

  it('WEB-4 searches where the map is tapped, without asking for the location', async () => {
    const geolocation = geolocationAnswering({ lat: 40.6, lng: -73.9 });
    renderWithProviders(<SearchPage geolocation={geolocation} styleUrl="https://tiles.example.test/style" />);
    await vi.waitFor(() => expect(maps).toHaveLength(1));

    act(() => maps[0]!.tap(40.71949, -73.98751));

    expect(await screen.findByRole('heading', { name: '2 places within 2 km' })).toBeInTheDocument();
    expect(recommend).toHaveBeenCalledWith({ lat: 40.719, lng: -73.988 }, 2000);
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(screen.getByText(en['search.mapHint'])).toBeInTheDocument();
  });

  it('WEB-5 moves to the card when its marker is tapped', async () => {
    renderWithProviders(<SearchPage geolocation={geolocationAnswering({ lat: 40.719, lng: -73.988 })} styleUrl="https://tiles.example.test/style" />);
    await vi.waitFor(() => expect(maps).toHaveLength(1));
    act(() => maps[0]!.tap(40.719, -73.988));
    await screen.findByRole('heading', { level: 2 });

    fireEvent.click(screen.getByRole('button', { name: /^2\. Delancey/ }));

    expect(document.activeElement).toBe(screen.getByRole('article', { name: /Delancey/ }));
  });

  it('WEB-4 says so when the browser cannot share a location', () => {
    renderWithProviders(<SearchPage />);

    shareLocation();

    expect(screen.getByText(en['location.unsupported'])).toBeInTheDocument();
  });

  it('REC-3 explains a location outside the coverage area', async () => {
    recommend.mockResolvedValue({ status: 'error', code: 'location.out_of_area' });
    renderWithProviders(<SearchPage geolocation={geolocationAnswering({ lat: 39.29, lng: -76.612 })} />);

    shareLocation();

    expect(await screen.findByText(en['results.error.location.out_of_area'])).toBeInTheDocument();
  });

  it('WEB-5 says when nothing is within the radius', async () => {
    recommend.mockResolvedValue({ status: 'ok', results: [] });
    renderWithProviders(<SearchPage geolocation={geolocationAnswering({ lat: 40.736, lng: -74.172 })} />);

    shareLocation();

    expect(await screen.findByText('No public parking found within 2 km. Try a wider search.')).toBeInTheDocument();
  });

  it('WEB-8 offers every operator type, all chosen, and sends no filter until one is unchosen', async () => {
    renderWithProviders(<SearchPage geolocation={geolocationAnswering({ lat: 40.797, lng: -74.474 })} />);
    const group = screen.getByRole('group', { name: en['search.operators.legend'] });
    const boxes = within(group).getAllByRole('checkbox');

    expect(boxes.map((box) => box.closest('label')?.textContent)).toEqual(['City-run', 'County-run', 'State-run', 'Transit agency', 'Public authority']);
    expect(screen.getByRole('checkbox', { name: en['search.unconfirmed.toggle'] })).toBeChecked();
    expect(boxes.every((box) => (box as HTMLInputElement).checked)).toBe(true);
    shareLocation();
    await screen.findByRole('heading', { level: 2 });
    expect(recommend).toHaveBeenLastCalledWith({ lat: 40.797, lng: -74.474 }, 2000);

    fireEvent.click(within(group).getByRole('checkbox', { name: 'City-run' }));

    await vi.waitFor(() =>
      expect(recommend).toHaveBeenLastCalledWith({ lat: 40.797, lng: -74.474 }, 2000, {
        operatorTypes: ['county', 'state', 'transit_agency', 'public_authority', 'unknown'],
      }),
    );
  });

  it('WEB-9 leaves out unconfirmed sites when their checkbox is cleared', async () => {
    renderWithProviders(<SearchPage geolocation={geolocationAnswering({ lat: 40.721, lng: -74.044 })} />);
    shareLocation();
    await screen.findByRole('heading', { level: 2 });

    fireEvent.click(screen.getByRole('checkbox', { name: en['search.unconfirmed.toggle'] }));

    await vi.waitFor(() =>
      expect(recommend).toHaveBeenLastCalledWith({ lat: 40.721, lng: -74.044 }, 2000, {
        operatorTypes: ['municipal', 'county', 'state', 'transit_agency', 'public_authority'],
      }),
    );
  });

  it('WEB-8 asks for at least one operator type, and doesn\'t search without one', async () => {
    renderWithProviders(<SearchPage geolocation={geolocationAnswering({ lat: 40.797, lng: -74.474 })} />);
    const group = screen.getByRole('group', { name: en['search.operators.legend'] });
    for (const box of within(group).getAllByRole('checkbox')) fireEvent.click(box);
    fireEvent.click(screen.getByRole('checkbox', { name: en['search.unconfirmed.toggle'] }));

    shareLocation();

    expect(await screen.findByText(en['search.operators.none'])).toBeInTheDocument();
    expect(recommend).not.toHaveBeenCalled();
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('REC-8 names a numbered lot with its number on the map marker', async () => {
    recommend.mockResolvedValue({ status: 'ok', results: [morristown2] });
    renderWithProviders(<SearchPage geolocation={geolocationAnswering({ lat: 40.797, lng: -74.474 })} styleUrl="https://tiles.example.test/style" />);
    await vi.waitFor(() => expect(maps).toHaveLength(1));

    act(() => maps[0]!.tap(40.797, -74.474));

    expect(await screen.findByRole('button', { name: '1. Morristown, lot 2, 180 m away' })).toBeInTheDocument();
  });

  it('WEB-9 labels an unconfirmed site\'s map marker as unconfirmed', async () => {
    recommend.mockResolvedValue({ status: 'ok', results: [montgomerySite] });
    renderWithProviders(<SearchPage geolocation={geolocationAnswering({ lat: 40.718, lng: -74.072 })} styleUrl="https://tiles.example.test/style" />);
    await vi.waitFor(() => expect(maps).toHaveLength(1));

    act(() => maps[0]!.tap(40.718, -74.072));

    const marker = await screen.findByRole('button', { name: '1. 179 Montgomery St., 60 m away, unconfirmed' });
    expect(marker).toHaveClass('map-marker--unconfirmed');
  });

  it('WEB-11 searches near a chosen town, without asking for the device\'s location', async () => {
    const geolocation = geolocationAnswering({ lat: 40.6, lng: -73.9 });
    renderWithProviders(<SearchPage geolocation={geolocation} />);
    const input = screen.getByRole('combobox', { name: en['address.label'] });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Hoboken, NJ' } });
    fireEvent.mouseDown(await screen.findByRole('option', { name: /Hoboken City/ }));

    await vi.waitFor(() => expect(recommend).toHaveBeenCalledWith({ lat: 40.745, lng: -74.032 }, 2000));
    expect(await screen.findByText('Searching near Hoboken City')).toBeInTheDocument();
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('WEB-2 has no axe violations with results showing', async () => {
    const { container } = renderWithProviders(<SearchPage geolocation={geolocationAnswering({ lat: 40.719, lng: -73.988 })} />);
    shareLocation();
    await screen.findAllByText(/Facilities Database/);

    expect(await axeViolations(container)).toEqual([]);
  });
});
