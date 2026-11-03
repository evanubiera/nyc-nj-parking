import { afterEach, describe, expect, inject, it } from 'vitest';
import { connect, textArray, type Sql } from './index.ts';

const info = inject('testDatabase');
let sql: Sql | undefined;
afterEach(async () => {
  await sql?.end();
  sql = undefined;
});

describe('textArray', () => {
  it('is sent as text[] even in the first query on a new connection', async () => {
    sql = connect(info.url, { max: 1 });

    const [row] = await sql`select pg_typeof(${textArray(sql, ['a', 'b'])})::text as type`;

    expect(row?.type).toBe('text[]');
  });
});
