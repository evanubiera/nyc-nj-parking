# ADR-0018: Essex County: unconfirmed sites in every town, and towns' own metered lots

- Status: Accepted (2026-11-07, by the user: "Yes, start Essex")
- Date: 2026-11-07
- Builds on: ADR-0012, ADR-0014, ADR-0015, ADR-0017

## Context

With Hudson County done, the user chose Essex County next. Checked on 2026-11-07 (specs/06):

- The State's parcel layer has 289 public (class 15C) parcels in Essex whose wording may say parking. Hudson's rule (ING-13) keeps 103 sites in 15 of Essex's 22 towns. Three are in Newark, recorded as "parking" and "tax lien foreclosure": private lots the City took for unpaid taxes, not public ones.
- Bloomfield's Parking Utility and South Orange's Parking Authority publish their metered lots with rates, time limits, and hours, on pages that state no terms beyond a copyright line or notice, like West New York's.
- Montclair's Parking Utility has a lot list, but the Township's site refuses scripted requests (403), so the worker can't read it. Newark publishes no list of its Parking Authority's lots.

## Decision

- **Unconfirmed sites** in all of Essex, with Hudson's rule, as a source of its own (`nj-parcels-essex-parking`): one source per county, from one shared adapter, so each county is admitted, run, and stored on its own. Land whose record says "tax lien" or "foreclosure" is left out, in every county.
- **Towns' own lots**, admitted with terms unstated (ADR-0014): Bloomfield's metered lots (`bloomfield-parking-lots`) and South Orange's (`south-orange-parking-lots`), with their meter hours, time limits, and rates, placed on their tax parcels. A lot either page lists that can't be placed with confidence is left out until it can be.
- A town's own parking authority or utility is `municipal` ("City-run"), as in Hudson (specs/03).

## Consequences

- Essex's towns have results, most of them unconfirmed; Bloomfield and South Orange have confirmed lots with rates.
- Montclair, the county's other town with a published list, waits on a way to read its site (SRC-15). Newark's lots show only as unconfirmed sites.
- The rest of Essex's towns' own pages haven't been checked yet (S4-28).
