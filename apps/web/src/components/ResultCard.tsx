import type { RecommendedFacility } from '@parking/api-client';
import { FormattedMessage, useIntl } from 'react-intl';
import { DIRECTIONS_APPS, directionsUrl } from '../utils/directions.ts';
import { facilityName } from '../utils/facilityName.ts';
import { MeteredHours } from './MeteredHours.tsx';
import { SourceCredits } from './SourceCredits.tsx';

/** One suggestion (REC-4, ATT-2, WEB-6). */
export function ResultCard({ facility, position }: { facility: RecommendedFacility; position?: number }) {
  const intl = useIntl();
  const hoursKnown = facility.meteredHours !== null || facility.openingHours !== null;
  const ratesKnown = facility.rates.length > 0;
  // WEB-6: the API doesn't send the number of spaces, so it's always among what's missing.
  const missing = !facility.confirmed
    ? 'details.missing.unconfirmed'
    : hoursKnown
      ? ratesKnown ? 'details.missing.spaces' : 'details.missing.ratesSpaces'
      : ratesKnown ? 'details.missing.hoursSpaces' : 'details.missing.hoursRatesSpaces';
  const name = facilityName(intl, facility);

  return (
    <article id={`card-${facility.id}`} className="result" aria-labelledby={`result-${facility.id}`} tabIndex={-1}>
      <h3 id={`result-${facility.id}`} className="result__name">
        {position !== undefined && (
          <span className={facility.confirmed ? 'result__number' : 'result__number result__number--unconfirmed'} aria-hidden="true">
            {position}
          </span>
        )}
        {name}
      </h3>
      <p className="result__meta">
        <FormattedMessage
          id="facility.meta"
          values={{
            kind: intl.formatMessage({ id: `facility.kind.${facility.kind}` }),
            operator: intl.formatMessage({ id: `facility.operatorType.${facility.operator.type}` }),
            distance:
              facility.distanceMeters < 1000
                ? intl.formatMessage({ id: 'facility.distance.meters' }, { meters: facility.distanceMeters })
                : intl.formatMessage({ id: 'facility.distance.kilometers' }, { km: facility.distanceMeters / 1000 }),
          }}
        />
      </p>
      {!facility.confirmed && (
        <p className="result__warning">
          <FormattedMessage id="facility.unconfirmed" />
        </p>
      )}
      <p className="result__address">
        {facility.address.line ? (
          <FormattedMessage id="facility.address" values={{ line: facility.address.line, locality: facility.address.locality }} />
        ) : (
          facility.address.locality
        )}
      </p>

      {facility.meteredHours && <MeteredHours hours={facility.meteredHours} />}
      <p className="result__unknown">
        <FormattedMessage id={missing} />
      </p>

      <p className="result__directions">
        <span className="result__directions-label">
          <FormattedMessage id="directions.label" />
        </span>
        {DIRECTIONS_APPS.map((app) => (
          <a
            key={app}
            className="result__directions-link"
            href={directionsUrl(app, facility.location)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={intl.formatMessage({ id: 'directions.linkLabel' }, { app: intl.formatMessage({ id: `directions.app.${app}` }), name })}
          >
            <FormattedMessage id={`directions.app.${app}`} />
          </a>
        ))}
      </p>
      {facility.officialUrl && (
        <p className="result__link">
          <a
            href={facility.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={intl.formatMessage({ id: 'facility.officialLinkLabel' }, { name })}
          >
            <FormattedMessage id="facility.officialLink" />
          </a>
        </p>
      )}
      <SourceCredits sources={facility.sources} />
    </article>
  );
}
