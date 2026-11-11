import type { RecommendedFacility } from '@parking/api-client';
import { FormattedMessage, useIntl } from 'react-intl';
import { DIRECTIONS_APPS, directionsUrl } from '../utils/directions.ts';
import { facilityName } from '../utils/facilityName.ts';
import { MeteredHours } from './MeteredHours.tsx';
import { OpeningHours } from './OpeningHours.tsx';
import { Rates } from './Rates.tsx';
import { SourceCredits } from './SourceCredits.tsx';

/** One suggestion (REC-4, ATT-2, WEB-6). Its heading is an h4 under a town's heading in an area's list (WEB-13). */
export function ResultCard({ facility, position, headingLevel = 3 }: { facility: RecommendedFacility; position?: number; headingLevel?: 3 | 4 }) {
  const intl = useIntl();
  const hoursKnown = facility.meteredHours !== null || facility.openingHours !== null;
  // WEB-6: lists only what this result doesn't show.
  const missing = [
    hoursKnown ? null : intl.formatMessage({ id: 'details.item.hours' }),
    facility.rates.length > 0 ? null : intl.formatMessage({ id: 'details.item.rates' }),
    facility.spaces === null ? intl.formatMessage({ id: 'details.item.spaces' }) : null,
  ].filter((item): item is string => item !== null);
  const name = facilityName(intl, facility);
  const Heading = headingLevel === 4 ? 'h4' : 'h3';
  const distanceMeters = facility.distanceMeters;

  return (
    <article id={`card-${facility.id}`} className="result" aria-labelledby={`result-${facility.id}`} tabIndex={-1}>
      <Heading id={`result-${facility.id}`} className="result__name">
        {position !== undefined && (
          <span className={facility.confirmed ? 'result__number' : 'result__number result__number--unconfirmed'} aria-hidden="true">
            {position}
          </span>
        )}
        {name}
      </Heading>
      <p className="result__meta">
        {/* An area's list has no point, so no distance (REC-11). */}
        <FormattedMessage
          id={distanceMeters === null ? 'facility.metaNoDistance' : 'facility.meta'}
          values={{
            kind: intl.formatMessage({ id: `facility.kind.${facility.kind}` }),
            operator: intl.formatMessage({ id: `facility.operatorType.${facility.operator.type}` }),
            distance:
              distanceMeters === null
                ? null
                : distanceMeters < 1000
                  ? intl.formatMessage({ id: 'facility.distance.meters' }, { meters: distanceMeters })
                  : intl.formatMessage({ id: 'facility.distance.kilometers' }, { km: distanceMeters / 1000 }),
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

      {facility.spaces !== null && (
        <p className="result__spaces">
          <FormattedMessage id="facility.spaces" values={{ count: facility.spaces }} />
        </p>
      )}
      {facility.openingHours && <OpeningHours hours={facility.openingHours} />}
      {facility.meteredHours && <MeteredHours hours={facility.meteredHours} />}
      <Rates rates={facility.rates} />
      {missing.length > 0 && (
        <p className="result__unknown">
          <FormattedMessage
            id={facility.confirmed ? 'details.missing' : 'details.missing.unconfirmed'}
            values={{ items: intl.formatList(missing, { type: 'conjunction' }) }}
          />
        </p>
      )}

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
