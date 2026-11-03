import { createHash } from 'node:crypto';
import { connectTest, resetData } from '@parking/db/testing';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { IngestionError } from '../src/errors.ts';
import { UpstreamHttp } from '../src/http.ts';
import { runSource } from '../src/run.ts';
import { fakeSource, testLogger } from './support.ts';

const sql = connectTest(inject('testDatabase'));
const http = new UpstreamHttp();
afterAll(() => sql.end());
beforeEach(() => resetData(sql));

async function runs() {
  return sql<{ id: number; status: string; error_code: string | null; snapshot_id: number | null; rows_read: number | null; finished_at: Date | null }[]>`
    select id::int as id, status, error_code, snapshot_id::int as snapshot_id, rows_read, finished_at from ingestion_run order by id`;
}

describe('runSource', () => {
  it('ING-2 stores the raw response as a snapshot with fetch time, hash, size, and content type', async () => {
    const body = '{"rows":[{"name":"Bay Ridge"}]}';
    const source = fakeSource({ body });

    const outcome = await runSource(source, { sql, http, logger: testLogger().logger });

    const [snapshot] = await sql<{ id: number; content_sha256: string; byte_size: number; content_type: string; body: Buffer; fetched_at: Date }[]>`
      select id::int as id, content_sha256, byte_size, content_type, body, fetched_at from source_snapshot`;
    expect(snapshot).toMatchObject({
      id: outcome.snapshotId,
      content_sha256: createHash('sha256').update(body).digest('hex'),
      byte_size: Buffer.byteLength(body),
      content_type: 'application/json',
    });
    expect(snapshot?.body.toString('utf8')).toBe(body);
    expect(snapshot?.fetched_at).toBeInstanceOf(Date);
    expect(source.applied[0]?.id).toBe(snapshot?.id);
  });

  it('ING-4 records a successful run with its counts and upserts the source', async () => {
    const outcome = await runSource(fakeSource(), { sql, http, logger: testLogger().logger });

    expect(outcome).toMatchObject({ status: 'succeeded', errorCode: null, counts: { rowsRead: 3, rowsWritten: 3, rowsWithdrawn: 0 } });
    const [run] = await runs();
    expect(run).toMatchObject({ status: 'succeeded', error_code: null, rows_read: 3, snapshot_id: outcome.snapshotId });
    expect(run?.finished_at).toBeInstanceOf(Date);
    const [source] = await sql`select publisher, modification_codes, data_updated_at from source where id = 'test-source'`;
    expect(source).toMatchObject({ publisher: 'Test Publisher', modification_codes: ['merged_across_sources'] });
    expect(source?.data_updated_at).toEqual(new Date('2026-07-16T13:00:00Z'));
  });

  it('ING-3 leaves data unchanged when normalizing fails, and records the code', async () => {
    const source = fakeSource({
      apply: async (tx) => {
        await tx`update source set title = 'written before the failure' where id = 'test-source'`;
        throw new IngestionError('normalize.invalid_record', 'row 2 has no coordinates');
      },
    });

    const outcome = await runSource(source, { sql, http, logger: testLogger().logger });

    expect(outcome).toMatchObject({ status: 'failed', errorCode: 'normalize.invalid_record' });
    const [row] = await sql`select title, data_updated_at from source where id = 'test-source'`;
    expect(row).toEqual({ title: 'Test dataset', data_updated_at: null });
    const [run] = await runs();
    expect(run).toMatchObject({ status: 'failed', error_code: 'normalize.invalid_record' });
    // The snapshot is kept, so the failure can be looked into.
    expect(run?.snapshot_id).toBe(outcome.snapshotId);
  });

  it('ING-3 records a failed fetch without a snapshot', async () => {
    const source = fakeSource({
      fetch: async () => {
        throw new IngestionError('upstream.timeout', 'took too long');
      },
    });

    const outcome = await runSource(source, { sql, http, logger: testLogger().logger });

    expect(outcome).toMatchObject({ status: 'failed', errorCode: 'upstream.timeout', snapshotId: null });
    expect(await sql`select 1 from source_snapshot`).toHaveLength(0);
    expect(source.applied).toHaveLength(0);
  });

  it('ING-3 records an unexpected error as run.unexpected', async () => {
    const source = fakeSource({
      apply: async () => {
        throw new TypeError('cannot read properties of undefined');
      },
    });

    const outcome = await runSource(source, { sql, http, logger: testLogger().logger });

    expect(outcome).toMatchObject({ status: 'failed', errorCode: 'run.unexpected' });
  });

  it('ING-7 skips normalizing when the bytes match the last successful run', async () => {
    let body = '{"version":1}';
    const source = fakeSource({ body: () => body });
    const context = { sql, http, logger: testLogger().logger };

    const first = await runSource(source, context);
    const second = await runSource(source, context);
    body = '{"version":2}';
    const third = await runSource(source, context);

    expect([first.status, second.status, third.status]).toEqual(['succeeded', 'unchanged', 'succeeded']);
    expect(second.snapshotId).toBe(first.snapshotId);
    expect(third.snapshotId).not.toBe(first.snapshotId);
    expect(source.applied).toHaveLength(2);
    expect(await sql`select 1 from source_snapshot`).toHaveLength(2);
  });

  it('ING-9 keeps the newest 10 snapshots per source, and every run', async () => {
    let version = 0;
    const source = fakeSource({ body: () => `{"version":${version}}` });
    const context = { sql, http, logger: testLogger().logger };

    for (version = 1; version <= 12; version += 1) {
      await runSource(source, context);
    }

    const snapshots = await sql<{ body: Buffer }[]>`select body from source_snapshot order by id`;
    expect(snapshots.map((snapshot) => snapshot.body.toString())).toEqual(
      Array.from({ length: 10 }, (_, index) => `{"version":${index + 3}}`),
    );
    expect(await runs()).toHaveLength(12);
  });

  it('ING-4 marks a run left running by a crash as failed with run.abandoned', async () => {
    const source = fakeSource();
    await runSource(source, { sql, http, logger: testLogger().logger });
    await sql`insert into ingestion_run (source_id, started_at, status) values ('test-source', now(), 'running')`;

    await runSource(source, { sql, http, logger: testLogger().logger });

    const all = await runs();
    expect(all.map((run) => [run.status, run.error_code])).toEqual([
      ['succeeded', null],
      ['failed', 'run.abandoned'],
      ['unchanged', null],
    ]);
  });

  it('ING-5 logs a failure by code only, never its message', async () => {
    const { logger, logs } = testLogger();
    const source = fakeSource({
      fetch: async () => {
        throw new IngestionError('upstream.http_status', 'GET with X-App-Token: secret-token-123 answered 403');
      },
    });

    await runSource(source, { sql, http, logger });

    expect(logs.text).toContain('upstream.http_status');
    expect(logs.text).not.toContain('secret-token-123');
    expect(logs.text).not.toContain('answered 403');
  });
});
