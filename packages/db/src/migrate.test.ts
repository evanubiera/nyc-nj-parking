import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, inject, it } from 'vitest';
import { migrate } from './index.ts';
import { connectTest } from './testing.ts';

const sql = connectTest(inject('testDatabase'));
afterAll(() => sql.end());

describe('migrations', () => {
  it('FND-5 applies each migration once', async () => {
    // The global setup has already migrated this database.
    expect(await migrate(sql)).toEqual([]);
    const rows = await sql<{ version: string }[]>`select version from schema_migrations order by version`;
    expect(rows.map((row) => row.version)).toEqual(['0001_foundation', '0002_facilities', '0003_nj_lots', '0004_unconfirmed_sites']);
  });

  it('FND-5 creates the slice 0 tables with PostGIS available', async () => {
    const tables = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_name in ('source', 'source_snapshot', 'ingestion_run')
      order by table_name`;
    expect(tables.map((row) => row.table_name)).toEqual(['ingestion_run', 'source', 'source_snapshot']);

    const [row] = await sql<{ meters: number }[]>`
      select round(ST_Distance('SRID=4326;POINT(-73.988 40.719)'::geography, 'SRID=4326;POINT(-73.988 40.729)'::geography)) as meters`;
    expect(Number(row?.meters)).toBeGreaterThan(1100);
    expect(Number(row?.meters)).toBeLessThan(1120);
  });

  it('FND-5 rolls back every pending migration when one fails', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'parking-migrations-'));
    try {
      await writeFile(join(directory, '9001_good.sql'), 'create table migration_test_good (id int);');
      await writeFile(join(directory, '9002_bad.sql'), 'create tabel nonsense;');

      await expect(migrate(sql, directory)).rejects.toThrow();

      const [found] = await sql<{ exists: boolean }[]>`select to_regclass('migration_test_good') is not null as exists`;
      expect(found?.exists).toBe(false);
      const versions = await sql`select 1 from schema_migrations where version like '900%'`;
      expect(versions).toHaveLength(0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('PRIV-1 no table has a column that could hold a user location', async () => {
    // The only location columns are facility locations. A new one needs a reason, and an entry here.
    const FACILITY_LOCATIONS = ['facility.location', 'source_record.location'];
    const columns = await sql<{ table_name: string; column_name: string }[]>`
      select table_name, column_name from information_schema.columns
      where table_schema = 'public'
        and (udt_name in ('geography', 'geometry') or column_name ~* '(^|_)(lat|lng|lon|latitude|longitude|query|search)(_|$)')
        and table_name not in ('spatial_ref_sys', 'geography_columns', 'geometry_columns')`;
    expect(columns.map((column) => `${column.table_name}.${column.column_name}`).sort()).toEqual(FACILITY_LOCATIONS.sort());
  });
});
