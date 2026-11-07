import type { MeteredHours as MeteredHoursData } from '@parking/api-client';
import { FormattedMessage, useIntl } from 'react-intl';
import { meterLines } from '../utils/meterHours.ts';
import { formatDays, formatTimes } from '../utils/timeFormat.ts';

/** WEB-6: when payment is required at the meters, and the time limit. Never shown as opening hours. */
export function MeteredHours({ hours }: { hours: MeteredHoursData }) {
  const intl = useIntl();
  const lines = meterLines(hours.periods);
  if (lines.length === 0) return null;

  return (
    <div className="metered-hours">
      <p className="metered-hours__heading">
        <FormattedMessage id="meter.heading" />
      </p>
      <ul className="metered-hours__list">
        {lines.map((line) => (
          <li key={[line.days.join(','), line.from, line.to, line.commercial].join('|')}>
            <FormattedMessage
              id={line.commercial ? 'meter.periodCommercial' : 'meter.period'}
              values={{ days: formatDays(intl, line.days), times: formatTimes(intl, line.from, line.to) }}
            />
            {line.limits.length > 0 && (
              <span className="metered-hours__limit">
                <FormattedMessage
                  id={line.limits.length > 1 ? 'meter.limitVaries' : 'meter.limit'}
                  values={{
                    hours: intl.formatList(
                      line.limits.map((count) => intl.formatMessage({ id: 'meter.hours' }, { count })),
                      { type: 'disjunction' },
                    ),
                  }}
                />
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
