import { QueryClient } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { AppProviders } from '../AppProviders.tsx';

const throwIntlError = (error: unknown) => {
  throw error;
};

/** Renders with the real providers. A missing or broken message throws, so the test fails (WEB-1). */
export function renderWithProviders(ui: ReactElement, { path = '/' }: { path?: string } = {}): RenderResult {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // A wrapper, so rerender() keeps the providers.
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders queryClient={queryClient} onIntlError={throwIntlError}>
      <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    </AppProviders>
  );
  return render(ui, { wrapper });
}

/** WEB-2: automated accessibility checks. jsdom can't compute colour contrast, so that rule is left to the browser. */
export async function axeViolations(container: Element): Promise<axe.Result[]> {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations;
}
