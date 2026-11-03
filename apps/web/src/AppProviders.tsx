import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { IntlProvider, type IntlConfig } from 'react-intl';
import { en } from './i18n/en.ts';

export interface AppProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
  /** Tests pass a handler that throws, so a missing message fails the test (WEB-1). */
  onIntlError?: IntlConfig['onError'];
}

export function AppProviders({ children, queryClient, onIntlError }: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? new QueryClient());
  return (
    <IntlProvider locale="en" defaultLocale="en" messages={en} {...(onIntlError ? { onError: onIntlError } : {})}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </IntlProvider>
  );
}
