import { useEffect } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { SiteFooter } from './components/SiteFooter.tsx';
import { SiteHeader } from './components/SiteHeader.tsx';
import { HomePage } from './pages/HomePage.tsx';

export function App() {
  const intl = useIntl();
  useEffect(() => {
    document.title = intl.formatMessage({ id: 'app.title' });
  }, [intl]);

  return (
    <>
      <a className="skip-link" href="#main">
        <FormattedMessage id="skipLink.label" />
      </a>
      <SiteHeader />
      <main id="main" className="page" tabIndex={-1}>
        <HomePage />
      </main>
      <SiteFooter />
    </>
  );
}
