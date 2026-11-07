# ADR-0012: Jersey City's lots without hours or rates, and unconfirmed sites from tax records

- Status: Accepted (2026-11-04, by the user)
- Date: 2026-11-04
- Amends: ADR-0007 ("every facility has an operator name and type"), for unconfirmed sites only
- Extended by ADR-0015 to all of Hudson County, with the county's wording for parking

## Context

Jersey City publishes 7 municipal lots, from 2020, with no hours, rates, or spaces (SRC-5). The State's parcel layer (NJOGIS, specs/06) shows 73 sites in Jersey City on public land (class 15C) that the assessor describes as parking; it includes those 7. It doesn't say who owns a site (owner names are redacted) or whether the public may park there, and some sites are school, staff, or post office lots. With only NJ Transit's lots, 9% of Jersey City's parcels are within 800 m of a lot the app shows; with the 7 city lots, 56%. We've drafted a request to the city's Parking Division for a current list, hours, and rates, but haven't sent it. The user reports that the city told them it doesn't object to the app showing its parking information.

The user asked to show Jersey City's results now, without hours, rates, or confirmation, accepting that trade-off.

## Options

1. Wait for the Parking Division's answer.
2. Show the city's 7 lots only.
3. Show the 7 lots, plus the candidate sites with no other obvious use (25), marked unconfirmed. Leave out sites beside a school, public building, park, or church, and railroad or right-of-way land (40), which are most likely staff or school lots.
4. Show all 73 sites, marked unconfirmed.

## Decision

Option 3, as chosen by the user.

- **City lots:** the Municipal Parking Lots dataset is admitted as `jc-municipal-lots`, with its 2020 data date shown. The State's parcel layer still describes each of the 7 lots as public parking (August 2026).
- **Unconfirmed sites:** the State's parcel layer is admitted as `nj-parcels-jc-parking`, for Jersey City only. A site is shown when its parcels are public (15C), described as parking, not railroad or right of way, and nothing else public (a school, public building, park, or church) is on the same block, its own parcels included (specs/06 has the exact rule). That's 23 sites on 2026-11-04: the first sort's 25, less two post office lots whose own parcels say so. A site within 90 m of a city lot or an NJ Transit lot is that lot, and the lot's record is the primary.
- **How they look:** an unconfirmed site is `confirmed: false` in the API, with operator type `unknown` and no operator name, because the owner isn't recorded. The web app says so on its card and its map label: public land recorded as parking, which may be for staff or permit holders only. It has no official page link. Its name is its address from the tax record. "Owner not recorded" is an option in the "Run by" filter, so people can hide these sites.
- Every result still says which of its hours, rates, and number of spaces aren't shown (WEB-6).
- Jersey City only. Other cities wait until this has been tried.

## Consequences

- ADR-0007's rule that every facility has an operator name and type now has one exception: unconfirmed sites. A confirmed facility still needs both. CLAUDE.md rule 6 says so.
- Some unconfirmed sites will turn out not to be public. When the Parking Division answers (SRC-5), confirmed lots come from that answer and the rest can be dropped.
- PRD-4 (NJ Transit's lots with no recorded owner are left out) is unchanged. Those lots have a different gap: NJ Transit lists them but doesn't record an owner.
- The State's parcel layer is fetched with two queries (the candidate parcels, and the other public parcels on their blocks), so its snapshot stores both responses together.
