// The sources the worker runs. Exactly the Admitted table in specs/06-sources.md; a test checks that (ING-6).
import { bayonneParkingLots } from './bayonne-parking-lots.ts';
import { bloomfieldParkingLots } from './bloomfield-parking-lots.ts';
import { harrisonParkingCenter } from './harrison-parking-center.ts';
import { hobokenGarages } from './hoboken-garages.ts';
import { jcMunicipalLots } from './jc-municipal-lots.ts';
import { njParcelsEssexParking, njParcelsHudsonParking } from './nj-parcels-parking.ts';
import { njdotParkRide } from './njdot-park-ride.ts';
import { njtParkingLots } from './njt-parking-lots.ts';
import { nycFacdbDot } from './nyc-facdb-dot.ts';
import { nutleyParkingLots } from './nutley-parking-lots.ts';
import { nycMetersOffstreet } from './nyc-meters-offstreet.ts';
import { southOrangeParkingLots } from './south-orange-parking-lots.ts';
import { unionCityParkingLots } from './union-city-parking-lots.ts';
import { veronaParkingLots } from './verona-parking-lots.ts';
import { wnyParkingLots } from './wny-parking-lots.ts';
import type { SourceDefinition } from './types.ts';

export const sources: readonly SourceDefinition[] = [
  nycFacdbDot,
  nycMetersOffstreet,
  jcMunicipalLots,
  njParcelsHudsonParking,
  wnyParkingLots,
  hobokenGarages,
  bayonneParkingLots,
  unionCityParkingLots,
  harrisonParkingCenter,
  njParcelsEssexParking,
  bloomfieldParkingLots,
  southOrangeParkingLots,
  nutleyParkingLots,
  veronaParkingLots,
];

/**
 * Built and tested, but not run. Under ADR-0014 they could go live without their requests being sent (SRC-2,
 * SRC-3); each moves into `sources` when the user says so (S2-10).
 */
export const awaitingAdmission: readonly SourceDefinition[] = [njtParkingLots, njdotParkRide];

export function findSource(id: string, registry: readonly SourceDefinition[] = sources): SourceDefinition | undefined {
  return registry.find((source) => source.id === id);
}
