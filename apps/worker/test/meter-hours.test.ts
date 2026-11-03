import { maskToDays } from '@parking/db';
import { describe, expect, it } from 'vitest';
import { parseMeterHours } from '../src/normalize/meter-hours.ts';

describe('parseMeterHours', () => {
  it('REC-4 reads the time limit, vehicle class, days, and times', () => {
    const [period, ...rest] = parseMeterHours('4HR Pas Mon-Sat 0700-2200')!;

    expect(rest).toEqual([]);
    expect(period).toEqual({
      days: 63,
      startsAt: '07:00',
      endsAt: '22:00',
      maxStayMinutes: 240,
      vehicleClass: 'passenger',
      sourceText: '4HR Pas Mon-Sat 0700-2200',
    });
    expect(maskToDays(period!.days)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
  });

  it.each([
    ['15HR Pas Mon - Sat 0700-2200', 900, '07:00', '22:00'],
    ['16HR Pas Mon-Sat 0000-2200', 960, '00:00', '22:00'],
    ['5HR Pas Mon-Sat 0700-2400', 300, '07:00', '24:00'],
    ['6 HR Pas Mon-Sat 0600-2200', 360, '06:00', '22:00'],
  ])('REC-4 reads the forms in the source: %s', (text, minutes, startsAt, endsAt) => {
    expect(parseMeterHours(text)).toMatchObject([{ maxStayMinutes: minutes, startsAt, endsAt, days: 63 }]);
  });

  it('REC-4 leaves the vehicle class empty when the text has none', () => {
    expect(parseMeterHours('11 HR Mon-Sat 0600-1800')).toMatchObject([{ maxStayMinutes: 660, vehicleClass: null }]);
  });

  it('REC-4 reads two periods separated by a slash', () => {
    const periods = parseMeterHours('2HR Com Mon-Sat 0700-1300 /2HR Pas Mon-Sat 1300-1900');

    expect(periods).toMatchObject([
      { vehicleClass: 'commercial', startsAt: '07:00', endsAt: '13:00' },
      { vehicleClass: 'passenger', startsAt: '13:00', endsAt: '19:00' },
    ]);
  });

  it('REC-4 reads a day range that wraps past Sunday', () => {
    const [period] = parseMeterHours('2HR Pas Sat-Mon 0900-1900')!;

    expect(maskToDays(period!.days)).toEqual(['mon', 'sat', 'sun']);
  });

  it.each([
    'Rate NOT Available - Please request a NEW PERSO, and Once it is Ready, Please Create a New Report',
    '4HR Pas Mon-Sat 0700-2500',
    '4HR Pas Mon-Sat 0760-2200',
    '',
  ])('REC-4 returns null for text it cannot read: %s', (text) => {
    expect(parseMeterHours(text)).toBeNull();
  });
});
