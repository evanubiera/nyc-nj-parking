import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Cron } from 'croner';
import { describe, expect, it } from 'vitest';
import { sources } from '../src/sources/registry.ts';

const SOURCES_SPEC = fileURLToPath(new URL('../../../specs/06-sources.md', import.meta.url));

/** Source IDs in the first column of the "## Admitted" table in specs/06-sources.md. */
export function admittedIds(markdown: string): string[] {
  const section = markdown.split(/^## Admitted\s*$/m)[1]?.split(/^## /m)[0] ?? '';
  return section
    .split('\n')
    .filter((line) => line.startsWith('|') && !/^\|\s*-+/.test(line))
    .slice(1) // the header row
    .flatMap((line) => [...(line.split('|')[1] ?? '').matchAll(/`([a-z0-9-]+)`/g)].map((match) => match[1]!));
}

describe('source registry', () => {
  it('ING-6 runs exactly the sources marked Admitted in specs/06-sources.md', () => {
    const admitted = admittedIds(readFileSync(SOURCES_SPEC, 'utf8'));

    expect(sources.map((source) => source.id).sort()).toEqual(admitted.sort());
  });

  it('ING-6 reads source IDs from the first column of the Admitted table only', () => {
    const markdown = [
      '## Admitted',
      '',
      '| Source ID | Dataset | Admitted in |',
      '|---|---|---|',
      '| `nyc-facdb-dot` | Facilities Database, `dot_publicparking` rows | S1-3 |',
      '| — | None yet. Slice 1 admits `nyc-meters-offstreet`. | — |',
      '',
      '## Terms that apply',
      '| `not-this-one` | | |',
    ].join('\n');

    expect(admittedIds(markdown)).toEqual(['nyc-facdb-dot']);
  });

  it('ING-6 gives every source a unique ID and a valid schedule', () => {
    const ids = sources.map((source) => source.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const source of sources) {
      expect(() => new Cron(source.schedule, { paused: true, timezone: 'America/New_York' }).stop()).not.toThrow();
    }
  });
});
