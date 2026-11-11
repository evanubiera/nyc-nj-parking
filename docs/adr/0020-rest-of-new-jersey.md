# ADR-0020: The rest of New Jersey: unconfirmed sites in the other 18 counties, in one source

- Status: Accepted (2026-11-10; the user asked "can we start doing the rest of NJ as well?")
- Date: 2026-11-10
- Builds on: ADR-0012, ADR-0015, ADR-0017, ADR-0018, ADR-0019

## Context

Hudson, Essex, and Bergen Counties have unconfirmed sites from the State's parcel layer, one source each, and their towns written out by hand. The other 18 counties have 460 towns. Checked on 2026-11-10 (specs/06):

- The layer has 1,858 public (class 15C) parcels in those counties whose wording may say parking; the most in one county is Monmouth's 251, well under the layer's 2,000 a query.
- NJOGIS's municipal boundaries give every town's code, matching the parcel layer's `PCL_MUN`, with its full and short names.
- ADR-0019's rule kept 727 sites. Their wording showed parking that serves something else, in words the three urban counties hadn't used: fields and ballfields written "BALLFIELDS", tennis courts, churches named by their denomination, a water utility's or rescue squad's lot, Green Acres land, a museum, a residence.
- Read anywhere on the block, those words dropped 80 sites, among them downtown and beach lots that only share a block with a pump station, a rescue squad, or Green Acres land.

## Decision

- **One source, `nj-parcels-rest-of-nj-parking`, for the 18 counties**, from the shared adapter: one candidates query per county, then the neighbours in parts. One source keeps the Sources page to one entry for the rest of the State; one county's change re-reads all 18, which takes about 20 seconds.
- **Town names** come from a script, `scripts/build-nj-towns.ts`, that reads NJOGIS's municipal boundaries and writes `nj-towns.ts`. A town is named as people say it ("Long Hill"), keeping its full name where the short one is shared by another NJ town ("Hamilton Township"), doesn't read as a place ("Lower Township"), or is a county's name ("Gloucester Township"). Where even the full name repeats across counties, the facility IDs carry the county. Hudson's, Essex's, and Bergen's tables and IDs are unchanged.
- **The rule, in every county:**
  - on the block, any field or tennis court, and a church named by its denomination, are other uses, like a pool or a church;
  - on the site's own parcels only: a water works, well, water tower, or filtering plant, Green Acres land, a museum or historical society, or a rescue squad is the use the parking serves, and a residence (or a disabled veteran's exemption) isn't a lot.
  - Municipal buildings, town halls, marinas, and boat ramps don't count: lots beside them are often public.
- **The snapshot** holds a list of candidates responses, one per county, for every parcel source; a snapshot stored before holds one response, and still reads.

## Consequences

- 708 unconfirmed sites in 212 more towns; with Hudson's, Essex's, and Bergen's, every NJ county has them. Hudson's, Essex's, and Bergen's results don't change.
- In the suburbs, assessors write "parking area" on land that may not be a lot: none of Washington Township's (Gloucester) 12 sites has a lot in OpenStreetMap (specs/06). Each site is still shown as unconfirmed, with the note that the public may not be able to park there.
- Towns' own lot pages are checked next, county by county, as in Essex and Bergen.
- NJ Transit's lot database, built but not running (SRC-2), would add confirmed lots across the State; whether to run it is the user's decision.
