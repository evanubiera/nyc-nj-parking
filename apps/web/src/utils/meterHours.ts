// Groups metered periods for display (WEB-6). Periods with the same days, times, and vehicle class but
// different limits come from different meters in one field, such as Avenue M's 4- and 15-hour meters.
import type { Day, MeterPeriod } from '@parking/api-client';

export interface MeterLine {
  days: Day[];
  from: string;
  to: string;
  commercial: boolean;
  limits: number[];
}

export function meterLines(periods: readonly MeterPeriod[]): MeterLine[] {
  const lines = new Map<string, MeterLine>();
  for (const period of periods) {
    const commercial = period.vehicleClass === 'commercial';
    const key = [period.days.join(','), period.from, period.to, commercial].join('|');
    const line = lines.get(key) ?? { days: period.days, from: period.from, to: period.to, commercial, limits: [] };
    if (period.maxStayMinutes !== null && !line.limits.includes(period.maxStayMinutes / 60)) {
      line.limits.push(period.maxStayMinutes / 60);
    }
    lines.set(key, line);
  }
  return [...lines.values()].map((line) => ({ ...line, limits: [...line.limits].sort((a, b) => a - b) }));
}

const WEEK: readonly Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** Consecutive days as ranges: mon,tue,wed,sat → [[mon, wed], [sat, sat]]. */
export function dayRanges(days: readonly Day[]): [Day, Day][] {
  const sorted = WEEK.filter((day) => days.includes(day));
  const ranges: [Day, Day][] = [];
  for (const day of sorted) {
    const last = ranges.at(-1);
    if (last && WEEK.indexOf(day) === WEEK.indexOf(last[1]) + 1) last[1] = day;
    else ranges.push([day, day]);
  }
  return ranges;
}

/** A Monday in UTC, used only to get the locale's name for each weekday. */
export function referenceDate(day: Day): Date {
  return new Date(Date.UTC(2026, 0, 5 + WEEK.indexOf(day)));
}

/** "07:00" as a UTC instant on the reference day, for formatting a wall-clock time. "24:00" is midnight. */
export function referenceTime(time: string): Date {
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  return new Date(Date.UTC(2026, 0, 5, hours % 24, minutes));
}
