import { Writable } from 'node:stream';
import type { TransactionSql } from '@parking/db';
import pino from 'pino';
import type { ApplyResult, FetchedData, SourceDefinition, StoredSnapshot } from '../src/sources/types.ts';

export class LogCapture extends Writable {
  readonly lines: string[] = [];

  override _write(chunk: Buffer, _encoding: BufferEncoding, callback: () => void): void {
    this.lines.push(...chunk.toString('utf8').split('\n').filter(Boolean));
    callback();
  }

  get text(): string {
    return this.lines.join('\n');
  }
}

export function testLogger() {
  const logs = new LogCapture();
  return { logs, logger: pino({ level: 'info' }, logs) };
}

export interface FakeSource extends SourceDefinition {
  applied: StoredSnapshot[];
}

export function fakeSource(options: {
  body?: string | (() => string);
  fetch?: () => Promise<FetchedData>;
  apply?: (tx: TransactionSql, snapshot: StoredSnapshot) => Promise<ApplyResult>;
  revision?: number;
} = {}): FakeSource {
  const applied: StoredSnapshot[] = [];
  const body = options.body ?? '{"rows":[1,2,3]}';
  return {
    id: 'test-source',
    publisher: 'Test Publisher',
    title: 'Test dataset',
    datasetUrl: 'https://data.example.test/d/test',
    termsUrl: 'https://data.example.test/terms',
    creditText: null,
    modificationCodes: ['merged_across_sources'],
    schedule: '15 4 * * *',
    revision: options.revision,
    applied,
    fetch:
      options.fetch ??
      (async () => ({
        body: new TextEncoder().encode(typeof body === 'function' ? body() : body),
        contentType: 'application/json',
        upstreamUpdatedAt: new Date('2026-07-16T13:00:00Z'),
      })),
    async apply(tx, snapshot) {
      applied.push(snapshot);
      return options.apply ? options.apply(tx, snapshot) : { rowsRead: 3, rowsWritten: 3, rowsWithdrawn: 0 };
    },
  };
}
