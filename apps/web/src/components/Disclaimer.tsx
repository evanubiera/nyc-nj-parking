import { FormattedMessage } from 'react-intl';

/** ATT-1. The text is a placeholder until PRD-2 is answered; see the catalog entry. */
export function Disclaimer() {
  return (
    <p className="disclaimer" data-open-question="PRD-2">
      <FormattedMessage id="disclaimer.text" />
    </p>
  );
}
