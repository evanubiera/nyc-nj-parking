// One ingestion run for one source (ADR-0005, specs/04-architecture.md "Ingestion flow").
import { createHash } from 'node:crypto';
import { textArray, type Sql } from '@parking/db';
import type { Logger } from 'pino';
import { errorCodeOf, type IngestionErrorCode } from './errors.ts';
import type { UpstreamHttp } from './http.ts';
import type { ApplyResult, SourceDefinition, SourceMetadata } from './sources/types.ts';

export type RunStatus = 'succeeded' | 'unchanged' | 'failed';

export interface RunOutcome {
  runId: number;
  status: RunStatus;
  errorCode: IngestionErrorCode | null;
  snapshotId: number | null;
  counts: ApplyResult | null;
}

export interface RunContext {
  sql: Sql;
  http: UpstreamHttp;
  logger: Logger;
  now?: () => Date;
}

export async function runSource(source: SourceDefinition, { sql, http, logger, now = () => new Date() }: RunContext): Promise<RunOutcome> {
  await upsertSource(sql, source);

  // A run still marked running belongs to a process that died (specs/03-data-model.md).
  await sql`
    update ingestion_run set status = 'failed', error_code = 'run.abandoned', finished_at = ${now()}
    where source_id = ${source.id} and status = 'running'`;

  const [run] = await sql<{ id: number }[]>`
    insert into ingestion_run (source_id, started_at, status) values (${source.id}, ${now()}, 'running')
    returning id::int as id`;
  const runId = run!.id;
  let snapshotId: number | null = null;

  try {
    const fetched = await source.fetch(http);
    const sha256 = createHash('sha256').update(fetched.body).digest('hex');

    // ING-7: the same bytes as the last successful run need no normalizing.
    const [last] = await sql<{ snapshotId: number; sha256: string }[]>`
      select s.id::int as "snapshotId", s.content_sha256 as sha256
      from ingestion_run r join source_snapshot s on s.id = r.snapshot_id
      where r.source_id = ${source.id} and r.status in ('succeeded', 'unchanged')
      order by r.started_at desc, r.id desc limit 1`;
    if (last && last.sha256 === sha256) {
      snapshotId = last.snapshotId;
      await finish(sql, runId, { status: 'unchanged', snapshotId, counts: null, errorCode: null }, now());
      logger.info({ sourceId: source.id, runId, status: 'unchanged' }, 'ingestion run finished');
      return { runId, status: 'unchanged', errorCode: null, snapshotId, counts: null };
    }

    // ING-2: keep the raw bytes before normalizing, outside the facility transaction.
    const fetchedAt = now();
    const [snapshot] = await sql<{ id: number }[]>`
      insert into source_snapshot (source_id, fetched_at, content_sha256, content_type, byte_size, upstream_updated_at, body)
      values (${source.id}, ${fetchedAt}, ${sha256}, ${fetched.contentType}, ${fetched.body.byteLength},
              ${fetched.upstreamUpdatedAt}, ${Buffer.from(fetched.body)})
      returning id::int as id`;
    snapshotId = snapshot!.id;
    await sql`update ingestion_run set snapshot_id = ${snapshotId} where id = ${runId}`;

    // ING-3: normalizing and writing happen in one transaction; any error leaves facility data unchanged.
    const counts = await sql.begin(async (tx) => {
      const result = await source.apply(tx, { ...fetched, id: snapshotId!, fetchedAt });
      await tx`update source set data_updated_at = ${fetched.upstreamUpdatedAt}, updated_at = now() where id = ${source.id}`;
      return result;
    });

    await finish(sql, runId, { status: 'succeeded', snapshotId, counts, errorCode: null }, now());
    await pruneSnapshots(sql, source.id);
    logger.info({ sourceId: source.id, runId, status: 'succeeded', ...counts }, 'ingestion run finished');
    return { runId, status: 'succeeded', errorCode: null, snapshotId, counts };
  } catch (error) {
    const errorCode = errorCodeOf(error);
    await finish(sql, runId, { status: 'failed', snapshotId, counts: null, errorCode }, now());
    if (snapshotId !== null) await pruneSnapshots(sql, source.id);
    // Codes only: messages can quote upstream content, and request details include the token (ING-5).
    logger.warn({ sourceId: source.id, runId, status: 'failed', errorCode }, 'ingestion run failed');
    return { runId, status: 'failed', errorCode, snapshotId, counts: null };
  }
}

/** ING-9: keeps the newest SNAPSHOTS_KEPT snapshots per source. Runs keep their row; their link is cleared. */
export const SNAPSHOTS_KEPT = 10;

async function pruneSnapshots(sql: Sql, sourceId: string): Promise<void> {
  await sql`
    delete from source_snapshot
    where source_id = ${sourceId} and id not in (
      select id from source_snapshot where source_id = ${sourceId}
      order by fetched_at desc, id desc limit ${SNAPSHOTS_KEPT})`;
}

export async function upsertSource(sql: Sql, source: SourceMetadata): Promise<void> {
  await sql`
    insert into source (id, publisher, title, dataset_url, terms_url, credit_text, modification_codes)
    values (${source.id}, ${source.publisher}, ${source.title}, ${source.datasetUrl}, ${source.termsUrl},
            ${source.creditText}, ${textArray(sql, source.modificationCodes)})
    on conflict (id) do update set
      publisher = excluded.publisher, title = excluded.title, dataset_url = excluded.dataset_url,
      terms_url = excluded.terms_url, credit_text = excluded.credit_text,
      modification_codes = excluded.modification_codes, updated_at = now()`;
}

async function finish(
  sql: Sql,
  runId: number,
  result: { status: RunStatus; snapshotId: number | null; counts: ApplyResult | null; errorCode: IngestionErrorCode | null },
  finishedAt: Date,
): Promise<void> {
  await sql`
    update ingestion_run set
      status = ${result.status}, error_code = ${result.errorCode}, snapshot_id = ${result.snapshotId},
      rows_read = ${result.counts?.rowsRead ?? null}, rows_written = ${result.counts?.rowsWritten ?? null},
      rows_withdrawn = ${result.counts?.rowsWithdrawn ?? null}, finished_at = ${finishedAt}
    where id = ${runId}`;
}
