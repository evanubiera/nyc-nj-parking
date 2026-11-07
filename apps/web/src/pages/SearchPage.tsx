import type { OperatorType } from '@parking/api-client';
import { lazy, Suspense, useCallback, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { AddressSearch } from '../components/AddressSearch.tsx';
import { LocationDialog } from '../components/LocationDialog.tsx';
import { OperatorFilter } from '../components/OperatorFilter.tsx';
import { DEFAULT_RADIUS, RadiusPicker } from '../components/RadiusPicker.tsx';
import { ResultCard } from '../components/ResultCard.tsx';
import { mapStyleUrl } from '../config.ts';
import { useDeviceLocation } from '../hooks/useDeviceLocation.ts';
import { useRecommendations } from '../hooks/useRecommendations.ts';
import type { Point } from '../utils/location.ts';
import { OPERATOR_TYPES } from '../utils/operatorTypes.ts';

// MapLibre is large, so the map loads only when it's configured (ADR-0009) and the page has rendered.
const ResultsMap = lazy(() => import('../components/ResultsMap.tsx'));

/**
 * WEB-4, WEB-5, WEB-8, WEB-11. Search near a town or address (the default), a tapped point, or the device's location,
 * which the person volunteers through a dialog.
 */
export function SearchPage({ geolocation, styleUrl = mapStyleUrl }: { geolocation?: Geolocation; styleUrl?: string | null }) {
  const intl = useIntl();
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  // WEB-8: kept in memory only, like the point.
  const [operatorTypes, setOperatorTypes] = useState<readonly OperatorType[]>(OPERATOR_TYPES);
  // The search point, already rounded (PRIV-3). Kept in memory only: never in the URL or storage.
  const [point, setPoint] = useState<Point | null>(null);
  const { state, locate, reset } = useDeviceLocation(geolocation, setPoint);
  const recommendations = useRecommendations(point, radius, operatorTypes);
  const noOperators = operatorTypes.length === 0;
  const distance = intl.formatMessage({ id: 'search.radius.option' }, { km: radius / 1000 });
  const results = !noOperators && recommendations.data?.status === 'ok' ? recommendations.data.results : [];

  // WEB-11: the chosen town or address, shown while its point is the search point. Memory only (PRIV-5).
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const searchNear = useCallback(
    (chosen: Point, label: string) => {
      reset();
      setPlaceLabel(label);
      setPoint(chosen);
    },
    [reset],
  );
  const searchAt = useCallback(
    (tapped: Point) => {
      reset();
      setPlaceLabel(null);
      setPoint(tapped);
    },
    [reset],
  );
  // WEB-4: the device's location only after the person agrees in the dialog. Once they have, in this visit, the button
  // searches straight away; the answer is kept in memory only, like the point.
  const [asking, setAsking] = useState(false);
  const [volunteered, setVolunteered] = useState(false);
  const searchNearDevice = useCallback(() => {
    setPlaceLabel(null);
    locate();
  }, [locate]);

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

      <AddressSearch onSelect={searchNear} />
      <p className="search__or" aria-hidden="true">
        <FormattedMessage id="search.or" />
      </p>
      <button
        type="button"
        className="button button--secondary search__locate"
        aria-haspopup={volunteered ? undefined : 'dialog'}
        onClick={() => (volunteered ? searchNearDevice() : setAsking(true))}
        disabled={state.status === 'locating'}
      >
        <svg className="search__locate-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          <circle cx="12" cy="12" r="7" fill="none" />
        </svg>
        <FormattedMessage id="search.useLocation" />
      </button>
      <LocationDialog
        open={asking}
        onShare={() => {
          setAsking(false);
          setVolunteered(true);
          searchNearDevice();
        }}
        onCancel={() => setAsking(false)}
      />
      <div className="search__controls">
        <RadiusPicker value={radius} onChange={setRadius} />
      </div>
      <OperatorFilter value={operatorTypes} onChange={setOperatorTypes} />
      {styleUrl && (
        <p className="search__hint">
          <FormattedMessage id="search.mapHint" />
        </p>
      )}

      <div className="search__status" role="status" aria-live="polite">
        {placeLabel && point && (
          <span className="search__status-line">
            <FormattedMessage id="search.near" values={{ label: placeLabel }} />
          </span>
        )}
        {state.status === 'locating' && <FormattedMessage id="location.locating" />}
        {state.status === 'denied' && <FormattedMessage id={styleUrl ? 'location.denied' : 'location.deniedNoMap'} />}
        {state.status === 'unavailable' && <FormattedMessage id="location.unavailable" />}
        {state.status === 'unsupported' && <FormattedMessage id="location.unsupported" />}
        {noOperators && <FormattedMessage id="search.operators.none" />}
        {!noOperators && point && recommendations.isPending && <FormattedMessage id="results.searching" />}
        {!noOperators && recommendations.data?.status === 'error' && (
          <FormattedMessage
            id={recommendations.data.code === 'location.out_of_area' ? 'results.error.location.out_of_area' : 'results.error.generic'}
          />
        )}
        {!noOperators && recommendations.data?.status === 'ok' && results.length === 0 && (
          <FormattedMessage id="results.empty" values={{ distance }} />
        )}
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
