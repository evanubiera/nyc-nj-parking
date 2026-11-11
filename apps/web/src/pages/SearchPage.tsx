import type { OperatorType, RecommendedFacility } from '@parking/api-client';
import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { AddressSearch } from '../components/AddressSearch.tsx';
import { AreaSearch } from '../components/AreaSearch.tsx';
import { LocationDialog } from '../components/LocationDialog.tsx';
import { OperatorFilter } from '../components/OperatorFilter.tsx';
import { DEFAULT_RADIUS, RadiusPicker } from '../components/RadiusPicker.tsx';
import { ResultCard } from '../components/ResultCard.tsx';
import { SearchBy, type SearchMode } from '../components/SearchBy.tsx';
import { mapStyleUrl } from '../config.ts';
import { useDeviceLocation } from '../hooks/useDeviceLocation.ts';
import { useRecommendations, type SearchTarget } from '../hooks/useRecommendations.ts';
import type { AreaOption } from '../services/areas.ts';
import type { Point } from '../utils/location.ts';
import { OPERATOR_TYPES } from '../utils/operatorTypes.ts';

// MapLibre is large, so the map loads only when it's configured (ADR-0009) and the page has rendered.
const ResultsMap = lazy(() => import('../components/ResultsMap.tsx'));

/**
 * WEB-4, WEB-5, WEB-8, WEB-11, WEB-13. Search by a town or address (the default), a city or a whole county or borough
 * chosen from dropdowns, the device's location (volunteered through a dialog), or a tapped point.
 */
export function SearchPage({ geolocation, styleUrl = mapStyleUrl }: { geolocation?: Geolocation; styleUrl?: string | null }) {
  const intl = useIntl();
  const [mode, setMode] = useState<SearchMode>('place');
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  // WEB-8: kept in memory only, like the point.
  const [operatorTypes, setOperatorTypes] = useState<readonly OperatorType[]>(OPERATOR_TYPES);
  // A point is already rounded (PRIV-3). Kept in memory only: never in the URL or storage.
  const [target, setTarget] = useState<SearchTarget | null>(null);
  const searchPoint = useCallback((point: Point) => setTarget({ kind: 'point', point }), []);
  const { state, locate, reset } = useDeviceLocation(geolocation, searchPoint);
  const recommendations = useRecommendations(target, radius, operatorTypes);
  const noOperators = operatorTypes.length === 0;
  const point = target?.kind === 'point' ? target.point : null;
  const distance = intl.formatMessage({ id: 'search.radius.option' }, { km: radius / 1000 });
  const results = !noOperators && recommendations.data?.status === 'ok' ? recommendations.data.results : [];

  // WEB-11, WEB-13: the chosen town, address, or area, shown while it's what's searched. Memory only (PRIV-5).
  const [label, setLabel] = useState<string | null>(null);
  const searchNear = useCallback(
    (chosen: Point, chosenLabel: string) => {
      reset();
      setLabel(chosenLabel);
      searchPoint(chosen);
    },
    [reset, searchPoint],
  );
  const searchArea = useCallback(
    (area: AreaOption) => {
      reset();
      setLabel(area.name);
      setTarget({ kind: 'area', area: area.id });
    },
    [reset],
  );
  const searchAt = useCallback(
    (tapped: Point) => {
      reset();
      setLabel(null);
      searchPoint(tapped);
    },
    [reset, searchPoint],
  );
  // WEB-4: the device's location only after the person agrees in the dialog. Once they have, in this visit, choosing it
  // searches straight away; the answer is kept in memory only, like the point.
  const [asking, setAsking] = useState(false);
  const [volunteered, setVolunteered] = useState(false);
  const searchNearDevice = useCallback(() => {
    setLabel(null);
    locate();
  }, [locate]);
  const shareDeviceLocation = () => (volunteered ? searchNearDevice() : setAsking(true));
  // WEB-4: "Not now" puts focus back on what opened the dialog. The browser does that for the button, but choosing from
  // a dropdown doesn't always leave the dropdown focused, so it's done here.
  const searchByRef = useRef<HTMLSelectElement>(null);
  const [askedFromSearchBy, setAskedFromSearchBy] = useState(false);
  const changeMode = (next: SearchMode) => {
    setMode(next);
    if (next === 'location') {
      setAskedFromSearchBy(!volunteered);
      shareDeviceLocation();
    }
  };

  const showCard = useCallback((id: string) => {
    const card = document.getElementById(`card-${id}`);
    card?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    card?.focus({ preventScroll: true });
  }, []);

  const inArea = target?.kind === 'area';
  return (
    <section className="search" aria-labelledby="search-heading">
      <h1 id="search-heading">
        <FormattedMessage id="search.heading" />
      </h1>
      <p className="search__intro">
        <FormattedMessage id="search.intro" />
      </p>

      <SearchBy ref={searchByRef} value={mode} onChange={changeMode} />
      {mode === 'place' && <AddressSearch onSelect={searchNear} />}
      {mode === 'city' && <AreaSearch withPlaces onPlace={searchNear} />}
      {mode === 'area' && <AreaSearch withPlaces={false} onArea={searchArea} />}
      {mode === 'location' && (
        <button
          type="button"
          className="button button--secondary search__locate"
          aria-haspopup={volunteered ? undefined : 'dialog'}
          onClick={() => {
            setAskedFromSearchBy(false);
            shareDeviceLocation();
          }}
          disabled={state.status === 'locating'}
        >
          <svg className="search__locate-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="3.5" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            <circle cx="12" cy="12" r="7" fill="none" />
          </svg>
          <FormattedMessage id="search.useLocation" />
        </button>
      )}
      <LocationDialog
        open={asking}
        onShare={() => {
          setAsking(false);
          setVolunteered(true);
          searchNearDevice();
        }}
        onCancel={() => setAsking(false)}
        // Once closed: the dropdown was inert while the dialog was open, so it can only take focus now.
        onClosed={() => {
          if (askedFromSearchBy) searchByRef.current?.focus();
        }}
      />
      {!inArea && (
        <div className="search__controls">
          <RadiusPicker value={radius} onChange={setRadius} />
        </div>
      )}
      <OperatorFilter value={operatorTypes} onChange={setOperatorTypes} />
      {styleUrl && (
        <p className="search__hint">
          <FormattedMessage id="search.mapHint" />
        </p>
      )}

      <div className="search__status" role="status" aria-live="polite">
        {label && target && (
          <span className="search__status-line">
            <FormattedMessage id={inArea ? 'search.in' : 'search.near'} values={{ label }} />
          </span>
        )}
        {state.status === 'locating' && <FormattedMessage id="location.locating" />}
        {state.status === 'denied' && <FormattedMessage id={styleUrl ? 'location.denied' : 'location.deniedNoMap'} />}
        {state.status === 'unavailable' && <FormattedMessage id="location.unavailable" />}
        {state.status === 'unsupported' && <FormattedMessage id="location.unsupported" />}
        {noOperators && <FormattedMessage id="search.operators.none" />}
        {!noOperators && target && recommendations.isPending && <FormattedMessage id="results.searching" />}
        {!noOperators && recommendations.data?.status === 'error' && (
          <FormattedMessage
            id={recommendations.data.code === 'location.out_of_area' ? 'results.error.location.out_of_area' : 'results.error.generic'}
          />
        )}
        {!noOperators && recommendations.data?.status === 'ok' && results.length === 0 && (
          <FormattedMessage id={inArea ? 'results.emptyArea' : 'results.empty'} values={{ distance, area: label }} />
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
            {inArea ? (
              <FormattedMessage id="results.headingArea" values={{ count: results.length, area: label }} />
            ) : (
              <FormattedMessage id="results.heading" values={{ count: results.length, distance }} />
            )}
          </h2>
          {inArea ? <ResultsByTown results={results} /> : <ResultList results={results} start={1} headingLevel={3} />}
        </section>
      )}
    </section>
  );
}

function ResultList({ results, start, headingLevel }: { results: readonly RecommendedFacility[]; start: number; headingLevel: 3 | 4 }) {
  return (
    <ol className="results__list" start={start}>
      {results.map((facility, index) => (
        <li key={facility.id}>
          <ResultCard facility={facility} position={start + index} headingLevel={headingLevel} />
        </li>
      ))}
    </ol>
  );
}

/** WEB-13: an area's facilities come sorted by town (REC-11); each town gets a heading, and numbering runs on. */
function ResultsByTown({ results }: { results: readonly RecommendedFacility[] }) {
  const towns: { name: string; start: number; results: RecommendedFacility[] }[] = [];
  results.forEach((facility, index) => {
    const last = towns.at(-1);
    if (last?.name === facility.address.locality) last.results.push(facility);
    else towns.push({ name: facility.address.locality, start: index + 1, results: [facility] });
  });
  return (
    <>
      {towns.map((town) => (
        <section key={town.name} className="results__town" aria-labelledby={`town-${town.start}`}>
          <h3 id={`town-${town.start}`} className="results__town-name">
            {town.name}
          </h3>
          <ResultList results={town.results} start={town.start} headingLevel={4} />
        </section>
      ))}
    </>
  );
}
