# ADR-0017: Unconfirmed sites a town says aren't for visitors are left out

- Status: Accepted (2026-11-07; proposed in this session as a follow-up to SRC-14, and the user asked to continue)
- Date: 2026-11-07
- Amends: ADR-0012 and ADR-0015, which show every site the tax-record rule keeps, as unconfirmed

## Context

Checking the rest of Hudson County (specs/06) found towns saying, on their own pages, that some of the lots the tax-record rule keeps aren't for visitors: North Bergen's Parking Authority rents its lots by the month, Guttenberg's 71st Street lot is "reserved, paid parking only", and East Newark says the parking lot areas throughout the Borough are private. The unconfirmed label already warns that a site "may be for staff or permit holders only", but showing a site its own town says isn't for visitors sends drivers somewhere they can't park.

## Decision

- A site is left out when its own town's page says it's rented, reserved, private, or for permit holders only. The list is checked by hand, by the site's first parcel, with the page each comes from (`NOT_FOR_VISITORS` in `nj-parcels-hudson-parking`, specs/06). On 2026-11-07: East Newark's 2 sites, Guttenberg's 1, and North Bergen's 2 at 1314 14th St and 600 Liberty Ave.
- A town's page is used only to leave a site out. Nothing from it is shown, so its terms (North Bergen's, for one) don't stand in the way.
- The Sources page says so (modification `sites_not_for_visitors_excluded`).
- A site is added to the list only where the town names it, or plainly covers it ("throughout the Borough"); a likeness of address alone isn't enough.

## Consequences

- Fewer unconfirmed sites, and fewer that send drivers to lots they can't use.
- The list is static: a lot a town later opens to visitors stays hidden until someone checks it again.
