import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { en } from '../i18n/en.ts';
import { sources } from '../test/facilities.ts';
import { axeViolations, renderWithProviders } from '../test/render.tsx';
import { SourcesPage } from './SourcesPage.tsx';

vi.mock('../services/sources.ts', () => ({ fetchSources: vi.fn(async () => sources) }));

describe('SourcesPage', () => {
  it('ATT-3 lists each source with its publisher, data date, links, and what we change', async () => {
    renderWithProviders(<SourcesPage />, { path: '/sources' });

    const facdb = await screen.findByRole('article', { name: 'Facilities Database' });
    expect(within(facdb).getByText('Published by Department of City Planning (DCP)')).toBeInTheDocument();
    expect(within(facdb).getByText('Data as of July 16, 2026')).toBeInTheDocument();
    expect(within(facdb).getByRole('link', { name: en['sources.dataset'] })).toHaveAttribute('href', 'https://data.cityofnewyork.us/d/ji82-xba5');
    expect(within(facdb).getByRole('link', { name: en['sources.terms'] })).toHaveAttribute(
      'href',
      'https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-204577',
    );
    expect(within(facdb).getByText(en['sources.change.merged_across_sources'])).toBeInTheDocument();

    const meters = screen.getByRole('article', { name: 'Parking Meters Locations and Status' });
    expect(within(meters).getByText(en['sources.change.meter_hours_parsed'])).toBeInTheDocument();
  });

  it('WEB-2 has no axe violations', async () => {
    const { container } = renderWithProviders(<SourcesPage />, { path: '/sources' });
    await screen.findByRole('article', { name: 'Facilities Database' });

    expect(await axeViolations(container)).toEqual([]);
  });
});
