import { QueryClient } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { AppProviders } from '../AppProviders.tsx';

/** Renders with the real providers. A missing or broken message throws, so the test fails (WEB-1). */
export function renderWithProviders(ui: ReactElement, { path = '/' }: { path?: string } = {}): RenderResult {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AppProviders
      queryClient={queryClient}
      onIntlError={(error) => {
        throw error;
      }}
    >
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </AppProviders>,
  );
}

/** WEB-2: automated accessibility checks. jsdom can't compute colour contrast, so that rule is left to the browser. */
export async function axeViolations(container: Element): Promise<axe.Result[]> {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations;
}
