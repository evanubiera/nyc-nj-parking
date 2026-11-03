import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { en } from '../i18n/en.ts';
import { avenueM, delancey, sources } from '../test/facilities.ts';
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

    expect(screen.getByText(en['hours.unknown'])).toBeInTheDocument();
    expect(screen.queryByText(en['meter.heading'])).not.toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Hours and rates for Delancey - Essex Municipal Parking Garage on the operator’s page' });
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
