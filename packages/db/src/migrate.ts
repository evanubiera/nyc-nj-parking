// FND-5: numbered SQL files in ../migrations, applied in order, each once, inside one transaction
// that holds an advisory lock, so the API and the worker can both start at the same time.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Sql } from './index.ts';

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));
const FILE_NAME = /^\d{4}_[a-z0-9_]+\.sql$/;
const LOCK_KEY = 7_340_211;

export async function migrate(sql: Sql, directory: string = MIGRATIONS_DIR): Promise<string[]> {
  const files = (await readdir(directory)).filter((name) => FILE_NAME.test(name)).sort();
  const applied: string[] = [];

  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${LOCK_KEY})`;
    await tx`
      create table if not exists schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      )`;
    const done = new Set((await tx<{ version: string }[]>`select version from schema_migrations`).map((row) => row.version));

    for (const file of files) {
      const version = file.slice(0, -'.sql'.length);
      if (done.has(version)) continue;
      const text = await readFile(join(directory, file), 'utf8');
      await tx.unsafe(text).simple();
      await tx`insert into schema_migrations (version) values (${version})`;
      applied.push(version);
    }
  });

  return applied;
}
