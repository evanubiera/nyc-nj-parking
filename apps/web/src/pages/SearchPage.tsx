import { lazy, Suspense, useCallback, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { DEFAULT_RADIUS, RadiusPicker } from '../components/RadiusPicker.tsx';
import { ResultCard } from '../components/ResultCard.tsx';
import { mapStyleUrl } from '../config.ts';
import { useDeviceLocation } from '../hooks/useDeviceLocation.ts';
import { useRecommendations } from '../hooks/useRecommendations.ts';
import type { Point } from '../utils/location.ts';

// MapLibre is large, so the map loads only when it's configured (ADR-0009) and the page has rendered.
const ResultsMap = lazy(() => import('../components/ResultsMap.tsx'));

/** WEB-4, WEB-5. Search from the device's location or a tapped point; the list works without the map. */
export function SearchPage({ geolocation, styleUrl = mapStyleUrl }: { geolocation?: Geolocation; styleUrl?: string | null }) {
  const intl = useIntl();
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  // The search point, already rounded (PRIV-3). Kept in memory only: never in the URL or storage.
  const [point, setPoint] = useState<Point | null>(null);
  const { state, locate, reset } = useDeviceLocation(geolocation, setPoint);
  const recommendations = useRecommendations(point, radius);
  const distance = intl.formatMessage({ id: 'search.radius.option' }, { km: radius / 1000 });
  const results = recommendations.data?.status === 'ok' ? recommendations.data.results : [];

  const searchAt = useCallback(
    (tapped: Point) => {
      reset();
      setPoint(tapped);
    },
    [reset],
  );
  const showCard = useCallback((id: string) => {
    const card = document.getElementById(`card-${id}`);
    card?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    card?.focus({ preventScroll: true });
  }, []);

  return (
    <section className="search" aria-labelledby="search-heading">
      <h1 id="search-heading">
        <FormattedMessage id="search.heading" />
      </h1>
      <p className="search__intro">
        <FormattedMessage id="search.intro" />
      </p>

      <div className="search__controls">
        <RadiusPicker value={radius} onChange={setRadius} />
        <button type="button" className="button" onClick={locate} disabled={state.status === 'locating'}>
          <FormattedMessage id="search.useLocation" />
        </button>
      </div>
      {styleUrl && (
        <p className="search__hint">
          <FormattedMessage id="search.mapHint" />
        </p>
      )}

      <div className="search__status" role="status" aria-live="polite">
        {state.status === 'locating' && <FormattedMessage id="location.locating" />}
        {state.status === 'denied' && <FormattedMessage id={styleUrl ? 'location.denied' : 'location.deniedNoMap'} />}
        {state.status === 'unavailable' && <FormattedMessage id="location.unavailable" />}
        {state.status === 'unsupported' && <FormattedMessage id="location.unsupported" />}
        {point && recommendations.isPending && <FormattedMessage id="results.searching" />}
        {recommendations.data?.status === 'error' && (
          <FormattedMessage
            id={recommendations.data.code === 'location.out_of_area' ? 'results.error.location.out_of_area' : 'results.error.generic'}
          />
        )}
        {recommendations.data?.status === 'ok' && results.length === 0 && <FormattedMessage id="results.empty" values={{ distance }} />}
      </div>

      {styleUrl && (
        <Suspense fallback={<div className="results-map results-map--loading" />}>
          <ResultsMap styleUrl={styleUrl} point={point} results={results} onSelectPoint={searchAt} onSelectFacility={showCard} />
        </Suspense>
      )}

      {results.length > 0 && (
        <section className="results" aria-labelledby="results-heading">
          <h2 id="results-heading">
            <FormattedMessage id="results.heading" values={{ count: results.length, distance }} />
          </h2>
          <ol className="results__list">
            {results.map((facility, index) => (
              <li key={facility.id}>
                <ResultCard facility={facility} position={index + 1} />
              </li>
            ))}
          </ol>
        </section>
      )}
    </section>
  );
}
