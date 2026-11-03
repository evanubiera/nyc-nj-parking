import { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { DEFAULT_RADIUS, RadiusPicker } from '../components/RadiusPicker.tsx';
import { ResultCard } from '../components/ResultCard.tsx';
import { useDeviceLocation } from '../hooks/useDeviceLocation.ts';
import { useRecommendations } from '../hooks/useRecommendations.ts';

/** WEB-4, WEB-5. The map comes with S1-9b (ADR-0009); the list works on its own. */
export function SearchPage({ geolocation }: { geolocation?: Geolocation }) {
  const intl = useIntl();
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const { state, locate } = useDeviceLocation(geolocation);
  const point = state.status === 'found' ? state.point : null;
  const recommendations = useRecommendations(point, radius);
  const distance = intl.formatMessage({ id: 'search.radius.option' }, { km: radius / 1000 });

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
          <FormattedMessage id={point ? 'search.searchAgain' : 'search.useLocation'} />
        </button>
      </div>

      <div className="search__status" role="status" aria-live="polite">
        {state.status === 'locating' && <FormattedMessage id="location.locating" />}
        {state.status === 'denied' && <FormattedMessage id="location.denied" />}
        {state.status === 'unavailable' && <FormattedMessage id="location.unavailable" />}
        {state.status === 'unsupported' && <FormattedMessage id="location.unsupported" />}
        {point && recommendations.isPending && <FormattedMessage id="results.searching" />}
        {recommendations.data?.status === 'error' && (
          <FormattedMessage
            id={recommendations.data.code === 'location.out_of_area' ? 'results.error.location.out_of_area' : 'results.error.generic'}
          />
        )}
        {recommendations.data?.status === 'ok' && recommendations.data.results.length === 0 && (
          <FormattedMessage id="results.empty" values={{ distance }} />
        )}
      </div>

      {recommendations.data?.status === 'ok' && recommendations.data.results.length > 0 && (
        <section className="results" aria-labelledby="results-heading">
          <h2 id="results-heading">
            <FormattedMessage id="results.heading" values={{ count: recommendations.data.results.length, distance }} />
          </h2>
          <ol className="results__list">
            {recommendations.data.results.map((facility) => (
              <li key={facility.id}>
                <ResultCard facility={facility} />
              </li>
            ))}
          </ol>
        </section>
      )}
    </section>
  );
}
