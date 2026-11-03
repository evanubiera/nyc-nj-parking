// Column encodings shared by the worker and the API (specs/03-data-model.md).

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type DayCode = (typeof DAYS)[number];

/** Days as a bit mask: Monday = 1 through Sunday = 64. */
export function daysToMask(days: readonly DayCode[]): number {
  return days.reduce((mask, day) => mask | (1 << DAYS.indexOf(day)), 0);
}

export function maskToDays(mask: number): DayCode[] {
  return DAYS.filter((_, index) => (mask & (1 << index)) !== 0);
}

/** "07:00:00" (a PostgreSQL time) → "07:00". PostgreSQL keeps 24:00:00 as is. */
export function timeOfDay(value: string): string {
  return value.slice(0, 5);
}
