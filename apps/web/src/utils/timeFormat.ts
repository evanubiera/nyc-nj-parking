import type { Day } from '@parking/api-client';
import type { IntlShape } from 'react-intl';
import { dayRanges, referenceDate, referenceTime } from './meterHours.ts';

/** "Mon–Sat", "every day", or "Mon, Wed" in the locale (WEB-6, WEB-12). */
export function formatDays(intl: IntlShape, days: readonly Day[]): string {
  if (days.length === 7) return intl.formatMessage({ id: 'meter.everyDay' });
  const name = (day: Day) => intl.formatDate(referenceDate(day), { weekday: 'short', timeZone: 'UTC' });
  return intl.formatList(
    dayRanges(days).map(([first, last]) =>
      first === last ? name(first) : intl.formatMessage({ id: 'meter.dayRange' }, { first: name(first), last: name(last) }),
    ),
  );
}

/** "8:00 AM to 6:00 PM", or "around the clock" for 00:00 to 24:00 (WEB-6, WEB-12). */
export function formatTimes(intl: IntlShape, from: string, to: string): string {
  if (from === '00:00' && to === '24:00') return intl.formatMessage({ id: 'time.allDay' });
  return intl.formatMessage({ id: 'time.range' }, { from: formatTime(intl, from), to: formatTime(intl, to) });
}

/** "07:00" as a wall-clock time in the locale, such as "7:00 AM". */
export function formatTime(intl: IntlShape, time: string): string {
  return intl.formatTime(referenceTime(time), { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
}
