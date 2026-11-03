import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { en } from '../i18n/en.ts';
import { fetchServiceHealth } from '../services/health.ts';
import { renderWithProviders } from '../test/render.tsx';
import { ServiceStatus } from './ServiceStatus.tsx';

vi.mock('../services/health.ts', () => ({ fetchServiceHealth: vi.fn() }));
const fetchHealth = vi.mocked(fetchServiceHealth);

beforeEach(() => {
  fetchHealth.mockReset();
});

describe('ServiceStatus', () => {
  it('WEB-3 shows checking until the service answers, then that it is running', async () => {
    let answer: (value: 'ok') => void = () => {};
    fetchHealth.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    renderWithProviders(<ServiceStatus />);

    expect(screen.getByRole('status')).toHaveTextContent(en['status.checking']);
    answer('ok');
    expect(await screen.findByText(en['status.ok'])).toBeInTheDocument();
  });

  it('WEB-3 shows that the service is unavailable', async () => {
    fetchHealth.mockResolvedValue('unavailable');
    renderWithProviders(<ServiceStatus />);

    expect(await screen.findByText(en['status.unavailable'])).toBeInTheDocument();
  });
});
