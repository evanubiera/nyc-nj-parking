# ADR-0019: Bergen County: unconfirmed sites, and a tighter rule for what isn't a public lot

- Status: Accepted (2026-11-07; the user asked to continue after Essex, and Bergen was chosen as the next county)
- Date: 2026-11-07
- Builds on: ADR-0012, ADR-0015, ADR-0017, ADR-0018

## Context

After Essex, Bergen County: 70 towns, the most populous county in the state, bordering Hudson and Essex. Checked on 2026-11-07 (specs/06):

- The parcel layer has 166 public (class 15C) parcels in Bergen whose wording may say parking. The county rule keeps sites in 35 towns, but Bergen's records also show parking that serves something else, or isn't a lot: Ridgefield Park's parking for a pool, a hockey field, and "Vet Pk" (Veterans Park); Oradell's "future parking"; and in Washington Township, four condominium units, each a single deeded parking space, sharing one block and lot.
- None of the five largest towns checked first publishes a list of its lots that we can read: Hackensack's parking page names only Lots A and T and the Atlantic Street Garage; Fort Lee's Parking Authority's domain has lapsed; Teaneck's map of its lots is gone with its site's redesign; Englewood and Ridgewood have no parking pages, and their lots are only in their codes on eCode360.

## Decision

- **Unconfirmed sites** in all of Bergen, as `nj-parcels-bergen-parking`, from the shared adapter, with the layer's abbreviated town names written out ("HASBROUCK HGHTS" is Hasbrouck Heights, "RIVEREDGE" is River Edge).
- **The rule, in every county:**
  - a pool, a ballfield (hockey, ball, athletic, soccer, football, baseball, softball), a rink, or a park written "PK" is another use on the block;
  - "future parking" isn't a lot, as land taken for unpaid taxes isn't (ADR-0018);
  - a condominium unit (a parcel number ending in a qualifier such as `_CPA02`) isn't a lot;
  - shapes sharing one parcel number are one parcel.
- Essex's results change by one site (Glen Ridge's, beside a swimming pool); Hudson's don't.

## Consequences

- Bergen's towns have results, all unconfirmed for now.
- The other towns' own pages are checked next, as in Essex.
