// The sources the worker runs. Exactly the Admitted table in specs/06-sources.md; a test checks that (ING-6).
import { nycFacdbDot } from './nyc-facdb-dot.ts';
import { nycMetersOffstreet } from './nyc-meters-offstreet.ts';
import type { SourceDefinition } from './types.ts';

export const sources: readonly SourceDefinition[] = [nycFacdbDot, nycMetersOffstreet];

export function findSource(id: string, registry: readonly SourceDefinition[] = sources): SourceDefinition | undefined {
  return registry.find((source) => source.id === id);
}
