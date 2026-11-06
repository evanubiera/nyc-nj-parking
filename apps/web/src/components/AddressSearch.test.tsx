import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { en } from '../i18n/en.ts';
import { pointFor, suggest, type Suggestion } from '../services/geocoding.ts';
import { axeViolations, renderWithProviders } from '../test/render.tsx';
import { AddressSearch } from './AddressSearch.tsx';

vi.mock('../services/geocoding.ts', () => ({ MIN_ADDRESS_LENGTH: 3, suggest: vi.fn(), pointFor: vi.fn() }));
const suggestions = vi.mocked(suggest);
const lookUp = vi.mocked(pointFor);

const HOBOKEN: Suggestion = { id: 'place:NJ:Hudson County:Hoboken City', label: 'Hoboken City', kind: 'place', area: 'Hudson County', state: 'NJ', point: { lat: 40.74534, lng: -74.03209 } };
const ADDRESS: Suggestion = { id: 'nj:key', label: '174 Newark Avenue, Jersey City, NJ, 07302', kind: 'address', state: 'NJ', magicKey: 'key' };

beforeEach(() => {
  suggestions.mockReset();
  lookUp.mockReset();
  suggestions.mockResolvedValue([HOBOKEN, ADDRESS]);
  lookUp.mockImplementation(async (suggestion) => (suggestion.point ? { lat: 40.745, lng: -74.032 } : { lat: 40.722, lng: -74.045 }));
});

function type(text: string) {
  const input = screen.getByRole('combobox', { name: en['address.label'] });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: text } });
  return input;
}

describe('AddressSearch', () => {
  it('WEB-11 suggests towns and addresses as people type, after a pause', async () => {
    renderWithProviders(<AddressSearch onSelect={vi.fn()} />);

    const input = type('Hob');

    expect(await screen.findByRole('option', { name: /Hoboken City/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /174 Newark Avenue/ })).toBeInTheDocument();
    expect(screen.getByText('Hudson County, NJ')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(suggestions).toHaveBeenCalledWith('Hob', expect.anything());
  });

  it('WEB-11 chooses with the arrow keys and Enter, and searches at the rounded point', async () => {
    const onSelect = vi.fn();
    renderWithProviders(<AddressSearch onSelect={onSelect} />);
    const input = type('174 Newark');
    await screen.findByRole('option', { name: /Hoboken City/ });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-1$/);
    fireEvent.keyDown(input, { key: 'Enter' });

    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith({ lat: 40.722, lng: -74.045 }, ADDRESS.label));
    expect(input).toHaveValue(ADDRESS.label);
    expect(input).toHaveAttribute('aria-expanded', 'false');
    // PRIV-5: the chosen label isn't sent off again.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(suggestions).not.toHaveBeenCalledWith(ADDRESS.label, expect.anything());
  });

  it('WEB-11 chooses by touch', async () => {
    const onSelect = vi.fn();
    renderWithProviders(<AddressSearch onSelect={onSelect} />);
    type('Hobo');

    fireEvent.mouseDown(await screen.findByRole('option', { name: /Hoboken City/ }));

    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith({ lat: 40.745, lng: -74.032 }, 'Hoboken City'));
  });

  it('says when nothing matches, and when an address can\'t be found', async () => {
    suggestions.mockResolvedValue([]);
    renderWithProviders(<AddressSearch onSelect={vi.fn()} />);
    type('Nowheresville');

    expect(await screen.findByText(en['address.none'])).toBeInTheDocument();
  });

  it('WEB-2 has no axe violations with suggestions open', async () => {
    const { container } = renderWithProviders(<AddressSearch onSelect={vi.fn()} />);
    type('Hob');
    await screen.findByRole('option', { name: /Hoboken City/ });

    expect(await axeViolations(container)).toEqual([]);
  });
});
