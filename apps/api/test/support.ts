import { Writable } from 'node:stream';
import type { Sql } from '@parking/db';
import { connect } from '@parking/db';
import { buildApp, type AppOptions } from '../src/app.ts';

/** Collects every log line the app writes, as parsed JSON and as raw text. */
export class LogCapture extends Writable {
  readonly lines: string[] = [];

  override _write(chunk: Buffer, _encoding: BufferEncoding, callback: () => void): void {
    this.lines.push(...chunk.toString('utf8').split('\n').filter(Boolean));
    callback();
  }

  get text(): string {
    return this.lines.join('\n');
  }

  get entries(): Record<string, unknown>[] {
    return this.lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  }
}

export async function appWithLogs(sql: Sql, options: Partial<AppOptions> = {}) {
  const logs = new LogCapture();
  const app = await buildApp({ sql, logger: { level: 'info', stream: logs }, ...options });
  return { app, logs };
}

/** A pool pointing at a port nothing listens on, for "database down" tests. */
export function unreachableDatabase(): Sql {
  return connect('postgres://nobody:nothing@127.0.0.1:9/nowhere', { max: 1, connectTimeoutSeconds: 1 });
}
