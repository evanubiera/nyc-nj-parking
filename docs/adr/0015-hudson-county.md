# ADR-0015: The rest of Hudson County: Hoboken's garages, and unconfirmed sites in every town

- Status: Accepted (2026-11-06, by the user)
- Date: 2026-11-06
- Amends: ADR-0012 ("Jersey City only. Other cities wait until this has been tried")

## Context

The app shows Jersey City's 7 city lots and 23 unconfirmed sites from tax records (ADR-0012), and West New York's 9 metered lots (ADR-0014). The user asked to continue with the rest of Hudson County's towns. Checked on 2026-11-06 (specs/06):

- Hoboken publishes its garages and lots on its own page, with each garage's capacity and whether it takes transient (hourly) parkers. It states no terms.
- Bayonne, Union City, North Bergen, Harrison, Secaucus, Weehawken, Guttenberg, Kearny, and East Newark publish no lists of their lots.
- The State's tax records describe parking differently from town to town: "PRKNG LOT 23PS", "GARAGE#B-810 PS", "MUNI PARK LOT". Jersey City's rule (ING-13) looked only for "PARKING".

## Decision

As the user asked:

- **Hoboken's garages** come from its page (`hoboken-garages`), admitted with terms unstated (ADR-0014): each garage whose transient parking the page lists as available (Garages B and D and Midtown on 2026-11-06), with its capacity, located on its tax parcel or, for Garage G, with the State's geocoder. A garage whose transient parking isn't available (Garage G today), and the two permit-only lots, are left out until the page changes. The page lists staff email addresses; they're removed before the page is stored.
- **Unconfirmed sites** cover all 12 Hudson County towns (`nj-parcels-hudson-parking`, replacing `nj-parcels-jc-parking`). The rule is ING-13's, with the county's wording for parking (`PARKING`, `PRKNG`, `PKG`, `GARAGE#…`, a number of spaces such as `810 PS`, `MUNI PARK LOT`, `PAVED LOT`), and a playground, a department's building, or a public works or maintenance building counted as another public use on the block. A site within 90 m of a Jersey City or NJ Transit lot is that lot, as before; within 60 m for West New York's lots and Hoboken's garages, which were placed on their own parcels (ING-14).
- Everything else in ADR-0012 holds: unconfirmed sites are labelled as such, show "Owner not recorded", have no official page, and can be hidden with their own checkbox.
- NJ Transit's and NJDOT's lots stay off until the user says otherwise.

## Consequences

- On 2026-11-06: 58 sites in 11 of the 12 towns (Kearny has none), of which 8 are lots we already list, so 50 are shown as unconfirmed; and Hoboken's 3 garages. In most towns every result is unconfirmed.
- Jersey City shows 21 unconfirmed sites instead of 23: the new uses rule out two, beside a playground or maintenance buildings.
- Facility IDs for Jersey City's sites stay as they were (`jc-site-…`); other towns' sites start with the town, such as `bayonne-site-…`.
- Migration 0006 removes the old source's records, runs, and snapshots, and withdraws any facility left with no records.
- A town that later publishes its list, or answers a request, gets confirmed lots that absorb the matching sites.
