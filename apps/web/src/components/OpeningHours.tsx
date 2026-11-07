import type { OpeningHours as OpeningHoursData } from '@parking/api-client';
import { FormattedMessage, useIntl } from 'react-intl';
import { formatDays, formatTime } from '../utils/timeFormat.ts';

/** REC-4, WEB-6: when the facility is open, as its source states it. Never meter hours, which have their own lines. */
export function OpeningHours({ hours }: { hours: OpeningHoursData }) {
  const intl = useIntl();
  if (hours.periods.length === 0) return null;

  return (
    <ul className="opening-hours">
      {hours.periods.map((period) => {
        const days = formatDays(intl, period.days);
        return (
          <li key={[period.days.join(','), period.opens, period.closes].join('|')}>
            {period.opens === '00:00' && period.closes === '24:00' ? (
              <FormattedMessage id="hours.allDay" values={{ days }} />
            ) : (
              <FormattedMessage
                id="hours.period"
                values={{ days, from: formatTime(intl, period.opens), to: formatTime(intl, period.closes) }}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
