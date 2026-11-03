// S1-9b: the results on a map, and tap-to-search (WEB-4, WEB-5, WEB-7). Loaded lazily, because MapLibre
// is large and the list works without it. The tile host comes from configuration (ADR-0009). MapLibre
// fetches tiles itself; that's the one network access outside src/services, and it never reaches our API.
import type { RecommendedFacility } from '@parking/api-client';
import { AttributionControl, Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useEffect, useRef } from 'react';
import { useIntl, type IntlShape } from 'react-intl';
import type { MessageId } from '../i18n/en.ts';
import { roundPoint, type Point } from '../utils/location.ts';

export interface ResultsMapProps {
  styleUrl: string;
  point: Point | null;
  results: RecommendedFacility[];
  onSelectPoint: (point: Point) => void;
  onSelectFacility: (id: string) => void;
}

// MapLibre finds its worker next to its own module, which Vite moves when it bundles dependencies.
// Importing the self-contained worker with ?url makes Vite serve it in development and copy it into builds.
setWorkerUrl(workerUrl);

/** Midtown, wide enough to show most of the city before a search. */
const START = { center: [-73.97, 40.73] as [number, number], zoom: 10 };
/** The API's coverage area (specs/05-api.md). The map doesn't pan outside it. */
const COVERAGE: [[number, number], [number, number]] = [
  [-75.6, 38.9],
  [-73.6, 41.4],
];

export default function ResultsMap({ styleUrl, point, results, onSelectPoint, onSelectFacility }: ResultsMapProps) {
  const intl = useIntl();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  // The latest handlers, for MapLibre's listeners, which are attached once.
  const select = useRef({ onSelectPoint, onSelectFacility });
  useEffect(() => {
    select.current = { onSelectPoint, onSelectFacility };
  }, [onSelectPoint, onSelectFacility]);

  useEffect(() => {
    if (!container.current) return;
    const instance = new MapLibreMap({
      container: container.current,
      style: styleUrl,
      center: START.center,
      zoom: START.zoom,
      maxBounds: COVERAGE,
      attributionControl: false,
      cooperativeGestures: true,
      locale: mapLocale(intl),
    });
    // WEB-7: the style's sources carry the OpenStreetMap credit; the control shows it in a corner.
    instance.addControl(new AttributionControl({ compact: true }), 'bottom-right');
    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    // PRIV-3: a tapped point is rounded before it goes anywhere.
    instance.on('click', (event) => select.current.onSelectPoint(roundPoint({ lat: event.lngLat.lat, lng: event.lngLat.lng })));
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
    };
  }, [styleUrl, intl]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const markers: Marker[] = [];

    if (point) {
      markers.push(new Marker({ element: markerElement('search', intl.formatMessage({ id: 'map.searchPoint' })) }).setLngLat([point.lng, point.lat]).addTo(instance));
    }
    results.forEach((facility, index) => {
      const label = intl.formatMessage(
        { id: 'map.facility' },
        { position: index + 1, name: facility.name, distance: distanceText(intl, facility.distanceMeters) },
      );
      const element = markerElement('facility', label, String(index + 1));
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        select.current.onSelectFacility(facility.id);
      });
      markers.push(new Marker({ element }).setLngLat([facility.location.lng, facility.location.lat]).addTo(instance));
    });

    if (point && results.length > 0) {
      const lngs = [point.lng, ...results.map((facility) => facility.location.lng)];
      const lats = [point.lat, ...results.map((facility) => facility.location.lat)];
      instance.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        // Room for the zoom buttons (top right) and the credits (bottom), so no marker hides under them.
        { padding: { top: 56, right: 64, bottom: 88, left: 40 }, maxZoom: 16, duration: 0 },
      );
    } else if (point) {
      instance.jumpTo({ center: [point.lng, point.lat], zoom: 14 });
    }

    return () => markers.forEach((marker) => marker.remove());
  }, [intl, point, results]);

  return (
    <div className="results-map" role="region" aria-label={intl.formatMessage({ id: 'map.label' })}>
      <div ref={container} className="results-map__canvas" />
    </div>
  );
}

function markerElement(kind: 'search' | 'facility', label: string, text?: string): HTMLElement {
  const element = document.createElement(kind === 'facility' ? 'button' : 'div');
  element.className = `map-marker map-marker--${kind}`;
  element.setAttribute('aria-label', label);
  element.title = label;
  if (kind === 'facility') (element as HTMLButtonElement).type = 'button';
  if (kind === 'search') element.setAttribute('role', 'img');
  if (text) element.textContent = text;
  return element;
}

function distanceText(intl: IntlShape, meters: number): string {
  return meters < 1000
    ? intl.formatMessage({ id: 'facility.distance.meters' }, { meters })
    : intl.formatMessage({ id: 'facility.distance.kilometers' }, { km: meters / 1000 });
}

/** MapLibre's control labels and gesture hints, from the catalog (WEB-1). */
function mapLocale(intl: IntlShape): Record<string, string> {
  const text = (id: MessageId) => intl.formatMessage({ id });
  return {
    'NavigationControl.ZoomIn': text('map.zoomIn'),
    'NavigationControl.ZoomOut': text('map.zoomOut'),
    'NavigationControl.ResetBearing': text('map.resetBearing'),
    'AttributionControl.ToggleAttribution': text('map.toggleAttribution'),
    'CooperativeGesturesHandler.MobileHelpText': text('map.gestures.mobile'),
    'CooperativeGesturesHandler.WindowsHelpText': text('map.gestures.windows'),
    'CooperativeGesturesHandler.MacHelpText': text('map.gestures.mac'),
    'Map.Title': text('map.label'),
    'Marker.Title': text('map.marker'),
  };
}
