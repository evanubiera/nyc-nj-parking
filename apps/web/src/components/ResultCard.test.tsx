import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { en } from '../i18n/en.ts';
import { avenueM, delancey, montgomerySite, morristown2, sources } from '../test/facilities.ts';
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

    expect(screen.getByText(en['details.missing.ratesSpaces'])).toBeInTheDocument();
    expect(screen.queryByText(en['details.missing.hoursRatesSpaces'])).not.toBeInTheDocument();
  });

  it('WEB-6 says only spaces are missing once hours and rates are known', () => {
    const withRates = {
      ...avenueM,
      rates: [{ days: ['mon' as const], from: '07:00', to: '22:00', kind: 'per_hour' as const, upToMinutes: null, price: { amountMinor: 150, currency: 'USD' } }],
    };
    renderWithProviders(<ResultCard facility={withRates} />);

    expect(screen.getByText(en['details.missing.spaces'])).toBeInTheDocument();
  });

  it('WEB-9 marks an unconfirmed site, says its owner isn\'t recorded, and offers no official link', async () => {
    const { container } = renderWithProviders(<ResultCard facility={montgomerySite} position={1} />);

    expect(screen.getByText(en['facility.unconfirmed'])).toBeInTheDocument();
    expect(screen.getByText(en['details.missing.unconfirmed'])).toBeInTheDocument();
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

    expect(screen.getByText("Hours, rates, and number of spaces aren't shown here. Check with the operator before you park.")).toBeInTheDocument();
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
