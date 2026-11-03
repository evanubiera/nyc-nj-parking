import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';
import { en } from './i18n/en.ts';
import { axeViolations, renderWithProviders } from './test/render.tsx';

vi.mock('./services/health.ts', () => ({ fetchServiceHealth: vi.fn(async () => 'ok') }));

describe('App', () => {
  it('ATT-1 shows the accuracy disclaimer placeholder on the page', async () => {
    renderWithProviders(<App />);

    const disclaimer = screen.getByText(en['disclaimer.text']);
    expect(disclaimer).toBeVisible();
    expect(disclaimer.closest('footer')).not.toBeNull();
    expect(disclaimer).toHaveAttribute('data-open-question', 'PRD-2');
    await screen.findByText(en['status.ok']);
  });

  it('WEB-1 takes its text and the document title from the message catalog', async () => {
    renderWithProviders(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en['home.heading']);
    expect(screen.getByRole('link', { name: en['skipLink.label'] })).toHaveAttribute('href', '#main');
    await waitFor(() => expect(document.title).toBe(en['app.title']));
  });

  it('WEB-2 has one main landmark, one h1, and no axe violations', async () => {
    const { container } = renderWithProviders(<App />);
    await screen.findByText(en['status.ok']);

    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(await axeViolations(container)).toEqual([]);
  });
});
