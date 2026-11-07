# ADR-0016: A city ordinance as a source, checked by its file's hash

- Status: Accepted (2026-11-07, by the user's request to add Bayonne)
- Date: 2026-11-07
- Builds on: ADR-0014 (sources with unstated terms), ADR-0015 (Hudson County)

## Context

The user asked to add Bayonne's lots. Checked on 2026-11-07 (specs/06):

- The Bayonne Parking Utility's page names six lots by number and street, as part of its permit rules, but has no list of lots.
- Ordinance O-16-64 (2016), on the City's own site as a PDF, sets the City's 12 metered parking lots by street and by tax block and lot. Its terms are unstated: the site's footer reads "© City of Bayonne, NJ. All Rights Reserved.", as West New York's does.
- The compiled code on eCode360 has the same 12 lots, with their hours, spaces, and fees, but General Code's terms forbid republishing it (as for Weehawken, SRC-11). It's read only as a check that the 12 lots are still in force.
- The State's tax records show 9 of the 12 as public parcels used for parking. The other 3 have changed since 2016: public housing, vacant land, a park, or a maintenance building.

The worker can't read a PDF's text without a new dependency, and an ordinance changes only when the Council amends it.

## Decision

- `bayonne-parking-lots` fetches O-16-64 from the City's site. Its lots were transcribed once by hand and placed on their tax parcels. Each run checks that the file's SHA-256 is still the one transcribed; if the City replaces the file, the run fails and changes nothing (ING-3) until someone checks the new file and updates the transcription (ING-15).
- 9 lots are shown, confirmed, run by the Bayonne Parking Utility, `municipal`, named by their street and located on their parcels. The 3 whose parcels have changed are left out.
- Hours, rates, and spaces aren't shown: the City's own pages don't give hours or spaces, and a rate can't be shown without its hours. The card says what's missing, as for Jersey City's lots.
- Admitted, terms unstated (ADR-0014).

## Consequences

- Bayonne's Broadway business district has confirmed lots; two of Bayonne's unconfirmed sites turn out to be among them.
- A later ordinance that amends the lots doesn't reach the app by itself: it's a new file, and has to be added by hand.
- The same approach could serve other towns whose lots are set only by ordinance, if the town posts the ordinance on its own site.
