import { useEffect } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Route, Routes } from 'react-router';
import { SiteFooter } from './components/SiteFooter.tsx';
import { SiteHeader } from './components/SiteHeader.tsx';
import { SearchPage } from './pages/SearchPage.tsx';
import { SourcesPage } from './pages/SourcesPage.tsx';

export function App({ geolocation }: { geolocation?: Geolocation }) {
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
        <Routes>
          <Route path="/" element={<SearchPage {...(geolocation ? { geolocation } : {})} />} />
          <Route path="/sources" element={<SourcesPage />} />
          <Route path="*" element={<SearchPage {...(geolocation ? { geolocation } : {})} />} />
        </Routes>
      </main>
      <SiteFooter />
    </>
  );
}
