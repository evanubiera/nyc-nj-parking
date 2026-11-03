import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { en } from '../i18n/en.ts';
import { fetchRecommendations } from '../services/recommendations.ts';
import { avenueM, delancey, sources } from '../test/facilities.ts';
import { axeViolations, renderWithProviders } from '../test/render.tsx';
import { SearchPage } from './SearchPage.tsx';

vi.mock('../services/recommendations.ts', () => ({ fetchRecommendations: vi.fn() }));
vi.mock('../services/sources.ts', () => ({ fetchSources: vi.fn(async () => sources) }));
const recommend = vi.mocked(fetchRecommendations);

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

beforeEach(() => {
  recommend.mockReset();
  recommend.mockResolvedValue({ status: 'ok', results: [avenueM, delancey] });
});

describe('SearchPage', () => {
  it('WEB-4 asks for the location only when the person chooses to search near them', async () => {
    const geolocation = geolocationAnswering({ lat: 40.71949, lng: -73.98751 });
    renderWithProviders(<SearchPage geolocation={geolocation} />);

    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: en['search.useLocation'] }));

    expect(await screen.findByRole('heading', { name: '2 places within 2 km' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('PRIV-3 passes on only the rounded point', async () => {
    renderWithProviders(<SearchPage geolocation={geolocationAnswering({ lat: 40.71949, lng: -73.98751 })} />);

    fireEvent.click(screen.getByRole('button', { name: en['search.useLocation'] }));
    await screen.findByRole('heading', { level: 2 });

    expect(recommend).toHaveBeenCalledWith({ lat: 40.719, lng: -73.988 }, 2000);
  });

  it('REC-2 searches again with the radius the person picks', async () => {
    renderWithProviders(<SearchPage geolocation={geolocationAnswering({ lat: 40.719, lng: -73.988 })} />);
    fireEvent.click(screen.getByRole('button', { name: en['search.useLocation'] }));
    await screen.findByRole('heading', { level: 2 });

    fireEvent.change(screen.getByLabelText(en['search.radius.label']), { target: { value: '5000' } });

    expect(await screen.findByRole('heading', { name: '2 places within 5 km' })).toBeInTheDocument();
    expect(recommend).toHaveBeenLastCalledWith({ lat: 40.719, lng: -73.988 }, 5000);
  });

  it('WEB-4 explains what to do when location sharing is off', async () => {
    renderWithProviders(<SearchPage geolocation={geolocationAnswering({ error: 1 })} />);

    fireEvent.click(screen.getByRole('button', { name: en['search.useLocation'] }));

    expect(await screen.findByText(en['location.denied'])).toBeInTheDocument();
    expect(recommend).not.toHaveBeenCalled();
  });

  it('WEB-4 says so when the browser cannot share a location', () => {
    renderWithProviders(<SearchPage />);

    fireEvent.click(screen.getByRole('button', { name: en['search.useLocation'] }));

    expect(screen.getByText(en['location.unsupported'])).toBeInTheDocument();
  });

  it('REC-3 explains a location outside the coverage area', async () => {
    recommend.mockResolvedValue({ status: 'error', code: 'location.out_of_area' });
    renderWithProviders(<SearchPage geolocation={geolocationAnswering({ lat: 39.29, lng: -76.612 })} />);

    fireEvent.click(screen.getByRole('button', { name: en['search.useLocation'] }));

    expect(await screen.findByText(en['results.error.location.out_of_area'])).toBeInTheDocument();
  });

  it('WEB-5 says when nothing is within the radius', async () => {
    recommend.mockResolvedValue({ status: 'ok', results: [] });
    renderWithProviders(<SearchPage geolocation={geolocationAnswering({ lat: 40.736, lng: -74.172 })} />);

    fireEvent.click(screen.getByRole('button', { name: en['search.useLocation'] }));

    expect(await screen.findByText('No public parking found within 2 km. Try a wider search.')).toBeInTheDocument();
  });

  it('WEB-2 has no axe violations with results showing', async () => {
    const { container } = renderWithProviders(<SearchPage geolocation={geolocationAnswering({ lat: 40.719, lng: -73.988 })} />);
    fireEvent.click(screen.getByRole('button', { name: en['search.useLocation'] }));
    await screen.findAllByText(/Facilities Database/);

    expect(await axeViolations(container)).toEqual([]);
  });
});
