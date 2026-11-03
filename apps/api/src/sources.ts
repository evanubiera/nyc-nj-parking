// S1-8: the sources behind the suggestions, with their credits and data dates (ATT-3). The worker
// writes these rows for the sources it runs, which are exactly the Admitted ones (ING-6).
import type { Source, SourceList } from '@parking/api-client';
import type { Sql } from '@parking/db';

export async function listSources(sql: Sql): Promise<SourceList> {
  const rows = await sql<{
    id: string;
    publisher: string;
    title: string;
    datasetUrl: string;
    termsUrl: string;
    creditText: string | null;
    modifications: Source['modifications'];
    dataUpdatedAt: Date | null;
  }[]>`
    select id, publisher, title, dataset_url as "datasetUrl", terms_url as "termsUrl", credit_text as "creditText",
      modification_codes as modifications, data_updated_at as "dataUpdatedAt"
    from source order by id`;
  return {
    sources: rows.map((row) => ({ ...row, dataUpdatedAt: row.dataUpdatedAt ? row.dataUpdatedAt.toISOString() : null })),
  };
}
