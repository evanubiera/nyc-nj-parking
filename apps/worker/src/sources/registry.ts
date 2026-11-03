// The sources the worker runs. Exactly the Admitted table in specs/06-sources.md; a test checks that (ING-6).
// Slice 1 adds nyc-facdb-dot and nyc-meters-offstreet here, and admits them in specs/06 in the same change.
import type { SourceDefinition } from './types.ts';

export const sources: readonly SourceDefinition[] = [];

export function findSource(id: string, registry: readonly SourceDefinition[] = sources): SourceDefinition | undefined {
  return registry.find((source) => source.id === id);
}
