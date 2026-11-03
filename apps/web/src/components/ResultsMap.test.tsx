import { fireEvent, screen } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { en } from '../i18n/en.ts';
import { avenueM, delancey } from '../test/facilities.ts';
import { AttributionControl, maps, markers, resetMaps } from '../test/maplibre.ts';
import { axeViolations, renderWithProviders } from '../test/render.tsx';
import ResultsMap from './ResultsMap.tsx';

vi.mock('maplibre-gl', () => import('../test/maplibre.ts'));

const STYLE = 'https://tiles.example.test/styles/positron';
const point = { lat: 40.719, lng: -73.988 };

function renderMap(props: Partial<Parameters<typeof ResultsMap>[0]> = {}) {
  const onSelectPoint = vi.fn();
  const onSelectFacility = vi.fn();
  const view = renderWithProviders(
    <ResultsMap styleUrl={STYLE} point={null} results={[]} onSelectPoint={onSelectPoint} onSelectFacility={onSelectFacility} {...props} />,
  );
  return { ...view, onSelectPoint, onSelectFacility, map: maps.at(-1)! };
}

beforeEach(() => resetMaps());

describe('ResultsMap', () => {
  it('WEB-7 loads the configured style and shows its credits in a corner', () => {
    const { map } = renderMap();

    expect(map.options.style).toBe(STYLE);
    expect(map.options.attributionControl).toBe(false);
    const attribution = map.controls.find((entry) => entry.control instanceof AttributionControl);
    expect(attribution?.position).toBe('bottom-right');
    expect((attribution?.control as AttributionControl).options.compact).toBe(true);
  });

  it('WEB-1 gives MapLibre its control labels from the catalog', () => {
    const { map } = renderMap();

    expect(map.options.locale).toMatchObject({
      'NavigationControl.ZoomIn': en['map.zoomIn'],
      'NavigationControl.ZoomOut': en['map.zoomOut'],
      'AttributionControl.ToggleAttribution': en['map.toggleAttribution'],
      'CooperativeGesturesHandler.MobileHelpText': en['map.gestures.mobile'],
    });
    expect(map.options.cooperativeGestures).toBe(true);
    expect(screen.getByRole('region', { name: en['map.label'] })).toBeInTheDocument();
  });

  it('PRIV-3 passes on a tapped point rounded to 3 decimal places', () => {
    const { map, onSelectPoint } = renderMap();

    act(() => map.tap(40.71949, -73.98751));

    expect(onSelectPoint).toHaveBeenCalledWith({ lat: 40.719, lng: -73.988 });
  });

  it('WEB-5 shows the search point and a numbered marker for each result, labelled from the catalog', () => {
    renderMap({ point, results: [delancey, avenueM] });

    expect(markers.map((marker) => marker.lngLat)).toEqual([
      [point.lng, point.lat],
      [delancey.location.lng, delancey.location.lat],
      [avenueM.location.lng, avenueM.location.lat],
    ]);
    expect(screen.getByRole('img', { name: en['map.searchPoint'] })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1. Delancey - Essex Municipal Parking Garage, 1.3 km away' })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: '2. Avenue M Municipal Parking Field, 340 m away' })).toHaveTextContent('2');
  });

  it('WEB-5 shows the facility, not a new search, when its marker is tapped', () => {
    const { onSelectFacility, onSelectPoint } = renderMap({ point, results: [avenueM] });

    fireEvent.click(screen.getByRole('button', { name: /Avenue M/ }));

    expect(onSelectFacility).toHaveBeenCalledWith(avenueM.id);
    expect(onSelectPoint).not.toHaveBeenCalled();
  });

  it('WEB-5 fits the search point and results into view, and centers on the point when there are none', () => {
    const { map, rerender } = renderMap({ point, results: [avenueM] });
    expect(map.fitted).toHaveLength(1);

    rerender(<ResultsMap styleUrl={STYLE} point={point} results={[]} onSelectPoint={vi.fn()} onSelectFacility={vi.fn()} />);

    expect(map.jumped).toContainEqual({ center: [point.lng, point.lat], zoom: 14 });
  });

  it('replaces the markers on a new search, and removes the map when it leaves the page', () => {
    const { map, rerender, unmount } = renderMap({ point, results: [avenueM] });
    const first = [...markers];

    rerender(<ResultsMap styleUrl={STYLE} point={point} results={[delancey]} onSelectPoint={vi.fn()} onSelectFacility={vi.fn()} />);
    unmount();

    expect(first.every((marker) => marker.removed)).toBe(true);
    expect(map.removed).toBe(true);
  });

  it('WEB-2 has no axe violations with markers showing', async () => {
    const { container } = renderMap({ point, results: [delancey, avenueM] });

    expect(await axeViolations(container)).toEqual([]);
  });
});
