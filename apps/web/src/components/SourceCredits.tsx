import type { SourceRef } from '@parking/api-client';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link } from 'react-router';
import { useSources } from '../hooks/useSources.ts';

/** ATT-2: the sources a facility was built from, and how current each one is. */
export function SourceCredits({ sources }: { sources: SourceRef[] }) {
  const intl = useIntl();
  const { data: known } = useSources();
  const titleOf = (id: string) => known?.find((source) => source.id === id)?.title ?? id;

  const parts = sources.map((source) =>
    source.dataUpdatedAt
      ? intl.formatMessage(
          { id: 'credits.source' },
          { title: titleOf(source.id), date: intl.formatDate(source.dataUpdatedAt, { dateStyle: 'medium', timeZone: 'America/New_York' }) },
        )
      : intl.formatMessage({ id: 'credits.sourceNoDate' }, { title: titleOf(source.id) }),
  );

  return (
    <p className="credits">
      <Link to="/sources">
        <FormattedMessage id="credits.line" values={{ sources: intl.formatList(parts) }} />
      </Link>
    </p>
  );
}
