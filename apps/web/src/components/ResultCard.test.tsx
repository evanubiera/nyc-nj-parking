import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { en } from '../i18n/en.ts';
import { avenueM, delancey, montgomerySite, morristown2, sources, wny66th } from '../test/facilities.ts';
import { axeViolations, renderWithProviders } from '../test/render.tsx';
import { ResultCard } from './ResultCard.tsx';

vi.mock('../services/sources.ts', () => ({ fetchSources: vi.fn(async () => sources) }));

describe('ResultCard', () => {
  it('REC-4 shows the name, kind, operator type, distance, and address', () => {
    renderWithProviders(<ResultCard facility={avenueM} />);

    expect(screen.getByRole('heading', { name: 'Avenue M Municipal Parking Field' })).toBeInTheDocument();
    expect(screen.getByText('Parking field · City-run · 340 m away')).toBeInTheDocument();
    expect(screen.getByText('1624 Chestnut Avenue, Brooklyn')).toBeInTheDocument();
  });

  it('REC-8 shows the lot number with the name, in the heading and the link\'s spoken name', () => {
    renderWithProviders(<ResultCard facility={morristown2} />);

    expect(screen.getByRole('heading', { name: 'Morristown, lot 2' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hours and rates on the operator’s page, for Morristown, lot 2' })).toBeInTheDocument();
    expect(screen.getByText('Morristown Town')).toBeInTheDocument();
  });

  it('WEB-6 says rates and spaces are missing on a metered field, which shows its metered hours', () => {
    renderWithProviders(<ResultCard facility={avenueM} />);

    expect(screen.getByText('Not shown here: rates and number of spaces. Check with the operator before you park.')).toBeInTheDocument();
  });

  it('WEB-6 lists only spaces once hours and rates are known', () => {
    const withRates = {
      ...avenueM,
      rates: [{ days: ['mon' as const], from: '07:00', to: '22:00', kind: 'per_hour' as const, upToMinutes: null, price: { amountMinor: 150, currency: 'USD' } }],
    };
    renderWithProviders(<ResultCard facility={withRates} />);

    expect(screen.getByText('Not shown here: number of spaces. Check with the operator before you park.')).toBeInTheDocument();
  });

  it('WEB-12 shows a lot\'s spaces, metered hours, and rates as money, and nothing as missing', async () => {
    const { container } = renderWithProviders(<ResultCard facility={wny66th} />);

    expect(screen.getByText('73 spaces')).toBeInTheDocument();
    expect(screen.getByText('Pay at the meter Mon–Sat, 9:00 AM to 9:00 PM')).toBeInTheDocument();
    expect(screen.getByText(en['rate.heading'])).toBeInTheDocument();
    expect(screen.getByText('$0.75 per hour, Mon–Sat, 9:00 AM to 9:00 PM')).toBeInTheDocument();
    expect(screen.getByText('Overnight pass: $10.00, every day, 9:01 PM to 9:00 AM')).toBeInTheDocument();
    // The hourly rate reads first, though the API lists the pass first.
    expect([...container.querySelectorAll('.rates__list li')].map((item) => item.textContent)[0]).toBe('$0.75 per hour, Mon–Sat, 9:00 AM to 9:00 PM');
    expect(container.querySelector('.result__unknown')).toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('WEB-9 marks an unconfirmed site, says its owner isn\'t recorded, and offers no official link', async () => {
    const { container } = renderWithProviders(<ResultCard facility={montgomerySite} position={1} />);

    expect(screen.getByText(en['facility.unconfirmed'])).toBeInTheDocument();
    expect(screen.getByText('Not shown here: hours, rates, and number of spaces. Check the signs on site before you park.')).toBeInTheDocument();
    expect(screen.getByText('Lot · Owner not recorded · 60 m away')).toBeInTheDocument();
    expect(screen.getByText('Jersey City')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /operator’s page/ })).not.toBeInTheDocument();
    expect(container.querySelector('.result__number--unconfirmed')).not.toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('WEB-9 shows no unconfirmed label on a confirmed result', () => {
    renderWithProviders(<ResultCard facility={avenueM} />);

    expect(screen.queryByText(en['facility.unconfirmed'])).not.toBeInTheDocument();
  });

  it('WEB-10 links to driving directions in Google Maps, Apple Maps, and Waze, with only the facility\'s location', async () => {
    const { container } = renderWithProviders(<ResultCard facility={morristown2} />);

    const google = screen.getByRole('link', { name: 'Google Maps directions to Morristown, lot 2' });
    const apple = screen.getByRole('link', { name: 'Apple Maps directions to Morristown, lot 2' });
    const waze = screen.getByRole('link', { name: 'Waze directions to Morristown, lot 2' });
    expect(google).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=40.79761%2C-74.47384&travelmode=driving');
    expect(apple).toHaveAttribute('href', 'https://maps.apple.com/directions?destination=40.79761%2C-74.47384&mode=driving');
    expect(waze).toHaveAttribute('href', 'https://www.waze.com/ul?ll=40.79761%2C-74.47384&navigate=yes');
    for (const link of [google, apple, waze]) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      // PRIV-1: the facility's point only; the map app starts from the person's own location.
      expect(new URL(link.getAttribute('href')!).search).not.toMatch(/origin|source|saddr/);
    }
    expect(await axeViolations(container)).toEqual([]);
  });

  it('WEB-10 gives an unconfirmed site directions too, so people can go and check it', () => {
    renderWithProviders(<ResultCard facility={montgomerySite} />);

    expect(screen.getByRole('link', { name: 'Waze directions to 179 Montgomery St.' })).toHaveAttribute('href', 'https://www.waze.com/ul?ll=40.71703%2C-74.04278&navigate=yes');
  });

  it('REC-4 shows distances of a kilometer or more in kilometers', () => {
    renderWithProviders(<ResultCard facility={delancey} />);

    expect(screen.getByText('Garage · City-run · 1.3 km away')).toBeInTheDocument();
  });

  it('WEB-6 labels meter hours as metered hours with their time limits, never as opening hours', () => {
    const { container } = renderWithProviders(<ResultCard facility={avenueM} />);

    expect(screen.getByText(en['meter.heading'])).toBeInTheDocument();
    expect(screen.getByText('Pay at the meter Mon–Sat, 7:00 AM to 10:00 PM')).toBeInTheDocument();
    expect(screen.getByText('Time limit: 4 hours or 15 hours, depending on the meter')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\bopen/i);
  });

  it('REC-6 says when hours are unknown and links to the operator’s page', () => {
    renderWithProviders(<ResultCard facility={delancey} />);

    expect(screen.getByText('Not shown here: hours, rates, and number of spaces. Check with the operator before you park.')).toBeInTheDocument();
    expect(screen.queryByText(en['meter.heading'])).not.toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Hours and rates on the operator’s page, for Delancey - Essex Municipal Parking Garage' });
    expect(link).toHaveAttribute('href', 'https://www.nyc.gov/html/dot/html/motorist/parkinglist.shtml#manhattan');
  });

  it('ATT-2 credits every source with its data date, linking to the Sources page', async () => {
    renderWithProviders(<ResultCard facility={avenueM} />);

    const credits = await screen.findByRole('link', {
      name: 'Data: Facilities Database, as of Jul 16, 2026 and Parking Meters Locations and Status, as of Nov 2, 2026',
    });
    expect(credits).toHaveAttribute('href', '/sources');
  });

  it('WEB-2 has no axe violations', async () => {
    const { container } = renderWithProviders(<ResultCard facility={avenueM} />);
    await screen.findByText(/Facilities Database/);

    expect(await axeViolations(container)).toEqual([]);
  });
});
