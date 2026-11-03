import { FormattedMessage, useIntl } from 'react-intl';
import { Link } from 'react-router';
import { useSources } from '../hooks/useSources.ts';

/** ATT-3: each source's publisher, links, data date, required credit, and what we change. */
export function SourcesPage() {
  const intl = useIntl();
  const { data, isPending, isError } = useSources();

  return (
    <section className="sources" aria-labelledby="sources-heading">
      <h1 id="sources-heading">
        <FormattedMessage id="sources.heading" />
      </h1>
      <p>
        <FormattedMessage id="sources.intro" />
      </p>
      {isPending && (
        <p role="status">
          <FormattedMessage id="sources.loading" />
        </p>
      )}
      {isError && (
        <p role="status">
          <FormattedMessage id="sources.error" />
        </p>
      )}
      {data?.map((source) => (
        <article key={source.id} className="source" aria-labelledby={`source-${source.id}`}>
          <h2 id={`source-${source.id}`}>{source.title}</h2>
          <p>
            <FormattedMessage id="sources.publisher" values={{ publisher: source.publisher }} />
          </p>
          <p>
            {source.dataUpdatedAt ? (
              <FormattedMessage
                id="sources.dataDate"
                values={{ date: intl.formatDate(source.dataUpdatedAt, { dateStyle: 'long', timeZone: 'America/New_York' }) }}
              />
            ) : (
              <FormattedMessage id="sources.dataDateUnknown" />
            )}
          </p>
          {source.creditText && (
            <p>
              <FormattedMessage id="sources.credit" values={{ text: source.creditText }} />
            </p>
          )}
          <p className="source__links">
            <a href={source.datasetUrl} target="_blank" rel="noopener noreferrer">
              <FormattedMessage id="sources.dataset" />
            </a>
            <a href={source.termsUrl} target="_blank" rel="noopener noreferrer">
              <FormattedMessage id="sources.terms" />
            </a>
          </p>
          {source.modifications.length > 0 && (
            <>
              <h3>
                <FormattedMessage id="sources.changesHeading" />
              </h3>
              <ul>
                {source.modifications.map((code) => (
                  <li key={code}>
                    <FormattedMessage id={`sources.change.${code}`} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </article>
      ))}
      <p>
        <Link to="/">
          <FormattedMessage id="sources.back" />
        </Link>
      </p>
    </section>
  );
}
