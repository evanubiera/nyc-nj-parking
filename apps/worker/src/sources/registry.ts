// The sources the worker runs. Exactly the Admitted table in specs/06-sources.md; a test checks that (ING-6).
import { jcMunicipalLots } from './jc-municipal-lots.ts';
import { njParcelsJcParking } from './nj-parcels-jc-parking.ts';
import { njdotParkRide } from './njdot-park-ride.ts';
import { njtParkingLots } from './njt-parking-lots.ts';
import { nycFacdbDot } from './nyc-facdb-dot.ts';
import { nycMetersOffstreet } from './nyc-meters-offstreet.ts';
import type { SourceDefinition } from './types.ts';

export const sources: readonly SourceDefinition[] = [nycFacdbDot, nycMetersOffstreet, jcMunicipalLots, njParcelsJcParking];

/**
 * Built and tested, but not run: ADR-0011 admits a source with unstated terms only once its publisher has
 * been asked (SRC-2, SRC-3). S2-10 moves them into `sources` when the requests are sent.
 */
export const awaitingAdmission: readonly SourceDefinition[] = [njtParkingLots, njdotParkRide];

export function findSource(id: string, registry: readonly SourceDefinition[] = sources): SourceDefinition | undefined {
  return registry.find((source) => source.id === id);
}
