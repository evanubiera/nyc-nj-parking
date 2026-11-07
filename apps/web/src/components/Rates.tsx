import type { Rate } from '@parking/api-client';
import { FormattedMessage, useIntl } from 'react-intl';
import { formatMoney } from '../utils/money.ts';
import { formatDays, formatTime } from '../utils/timeFormat.ts';

/** The order people read rates in: what an hour costs first, then longer stays, then passes and permits. */
const KIND_ORDER: readonly Rate['kind'][] = ['per_hour', 'up_to_duration', 'daily_max', 'overnight_pass', 'monthly_permit'];

/** WEB-12: the rates a source states, with their days and times, as money in the locale. */
export function Rates({ rates: given }: { rates: readonly Rate[] }) {
  const intl = useIntl();
  if (given.length === 0) return null;
  const rates = [...given].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  return (
    <div className="rates">
      <p className="rates__heading">
        <FormattedMessage id="rate.heading" />
      </p>
      <ul className="rates__list">
        {rates.map((rate, index) => (
          <li key={index}>
            <FormattedMessage
              id={`rate.${rate.kind}`}
              values={{
                price: formatMoney(intl, rate.price),
                hours: rate.upToMinutes === null ? '' : intl.formatMessage({ id: 'meter.hours' }, { count: rate.upToMinutes / 60 }),
                days: formatDays(intl, rate.days),
                from: formatTime(intl, rate.from),
                to: formatTime(intl, rate.to),
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
