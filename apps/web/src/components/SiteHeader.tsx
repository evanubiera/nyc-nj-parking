import { FormattedMessage } from 'react-intl';

export function SiteHeader() {
  return (
    <header className="site-header">
      <p className="site-name">
        <FormattedMessage id="app.name" />
      </p>
    </header>
  );
}
