import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router';
import { Disclaimer } from './Disclaimer.tsx';
import { ServiceStatus } from './ServiceStatus.tsx';

/** On every page (ATT-1), with the link to the Sources page (ATT-3). */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Disclaimer />
      <p>
        <Link to="/sources">
          <FormattedMessage id="footer.sources" />
        </Link>
      </p>
      <ServiceStatus />
    </footer>
  );
}
