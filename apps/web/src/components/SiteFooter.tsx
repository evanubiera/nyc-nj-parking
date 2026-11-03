import { Disclaimer } from './Disclaimer.tsx';
import { ServiceStatus } from './ServiceStatus.tsx';

/** On every page (ATT-1). Slice 1 adds the link to the Sources page (ATT-3). */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Disclaimer />
      <ServiceStatus />
    </footer>
  );
}
