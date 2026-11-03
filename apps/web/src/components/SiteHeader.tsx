import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router';

export function SiteHeader() {
  return (
    <header className="site-header">
      <p className="site-name">
        <Link to="/">
          <FormattedMessage id="app.name" />
        </Link>
      </p>
    </header>
  );
}
