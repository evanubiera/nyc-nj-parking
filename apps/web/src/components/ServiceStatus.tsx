import { FormattedMessage } from 'react-intl';
import { useServiceHealth } from '../hooks/useServiceHealth.ts';

export function ServiceStatus() {
  const { data, isPending } = useServiceHealth();
  const state = isPending ? 'checking' : data === 'ok' ? 'ok' : 'unavailable';

  return (
    <p role="status" className={`service-status service-status--${state}`}>
      <span className="service-status__dot" aria-hidden="true" />
      <FormattedMessage id={`status.${state}`} />
    </p>
  );
}
