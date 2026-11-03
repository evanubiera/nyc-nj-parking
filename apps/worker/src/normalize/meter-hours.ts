// Parses the meters' `meter_hours` text, such as "4HR Pas Mon-Sat 0700-2200", into meter periods (S1-4).
// These are when payment is required and the time limit, not opening hours (WEB-6). Forms seen on
// 2026-11-03 are in specs/06-sources.md; anything else returns null and adds no period.
import { DAYS, daysToMask, type DayCode } from '@parking/db';

export interface MeterPeriod {
  /** Bit mask, Monday = 1 through Sunday = 64. */
  days: number;
  startsAt: string;
  endsAt: string;
  maxStayMinutes: number | null;
  vehicleClass: 'passenger' | 'commercial' | null;
  sourceText: string;
}

const DAY_NAMES: Record<string, DayCode> = { mon: 'mon', tue: 'tue', wed: 'wed', thu: 'thu', fri: 'fri', sat: 'sat', sun: 'sun' };
const SEGMENT =
  /^(\d{1,2})\s*HR\s+(?:(Pas|Com)\s+)?(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*(?:-\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun))?\s+(\d{4})\s*-\s*(\d{4})$/i;

export function parseMeterHours(text: string): MeterPeriod[] | null {
  const segments = text.split('/').map((segment) => segment.trim());
  const periods: MeterPeriod[] = [];
  for (const segment of segments) {
    const match = SEGMENT.exec(segment);
    if (!match) return null;
    const [, hours, vehicle, firstDay, lastDay, from, to] = match;
    const startsAt = clock(from!);
    const endsAt = clock(to!);
    if (!startsAt || !endsAt) return null;
    periods.push({
      days: daysToMask(dayRange(DAY_NAMES[firstDay!.toLowerCase()]!, DAY_NAMES[(lastDay ?? firstDay)!.toLowerCase()]!)),
      startsAt,
      endsAt,
      maxStayMinutes: Number(hours) * 60,
      vehicleClass: vehicle ? (vehicle.toLowerCase() === 'com' ? 'commercial' : 'passenger') : null,
      sourceText: text,
    });
  }
  return periods;
}

/** Mon..Sat, or a range that wraps, such as Sat..Mon. */
function dayRange(first: DayCode, last: DayCode): DayCode[] {
  const start = DAYS.indexOf(first);
  const end = DAYS.indexOf(last);
  const length = ((end - start + 7) % 7) + 1;
  return Array.from({ length }, (_, offset) => DAYS[(start + offset) % 7]!);
}

/** "0700" → "07:00"; "2400" → "24:00"; anything out of range → null. */
function clock(hhmm: string): string | null {
  const hours = Number(hhmm.slice(0, 2));
  const minutes = Number(hhmm.slice(2));
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes !== 0)) return null;
  return `${hhmm.slice(0, 2)}:${hhmm.slice(2)}`;
}
