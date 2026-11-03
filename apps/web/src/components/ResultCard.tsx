import type { RecommendedFacility } from '@parking/api-client';
import { FormattedMessage, useIntl } from 'react-intl';
import { MeteredHours } from './MeteredHours.tsx';
import { SourceCredits } from './SourceCredits.tsx';

/** One suggestion (REC-4, ATT-2, WEB-6). */
export function ResultCard({ facility, position }: { facility: RecommendedFacility; position?: number }) {
  const intl = useIntl();
  const hoursKnown = facility.meteredHours !== null || facility.openingHours !== null;

  return (
    <article id={`card-${facility.id}`} className="result" aria-labelledby={`result-${facility.id}`} tabIndex={-1}>
      <h3 id={`result-${facility.id}`} className="result__name">
        {position !== undefined && (
          <span className="result__number" aria-hidden="true">
            {position}
          </span>
        )}
        {facility.name}
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
      <p className="result__address">
        {facility.address.line ? (
          <FormattedMessage id="facility.address" values={{ line: facility.address.line, locality: facility.address.locality }} />
        ) : (
          facility.address.locality
        )}
      </p>

      {facility.meteredHours && <MeteredHours hours={facility.meteredHours} />}
      {!hoursKnown && (
        <p className="result__unknown">
          <FormattedMessage id="hours.unknown" />
        </p>
      )}

      <p className="result__link">
        <a
          href={facility.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={intl.formatMessage({ id: 'facility.officialLinkLabel' }, { name: facility.name })}
        >
          <FormattedMessage id="facility.officialLink" />
        </a>
      </p>
      <SourceCredits sources={facility.sources} />
    </article>
  );
}
