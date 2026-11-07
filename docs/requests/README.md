# Data requests

Material to send with requests to publishers and operators. Each file says where it came from, so it can be rebuilt or questioned.

- [jersey-city-parking-division.md](jersey-city-parking-division.md): the draft request to Jersey City (SRC-5), how to send it, and an OPRA fallback. Not sent.
- [jersey-city-parking-candidates.csv](jersey-city-parking-candidates.csv): the site list that goes with it (below).
- [west-new-york-parking-utility.md](west-new-york-parking-utility.md): an optional request to West New York (SRC-10), asking for each lot's time limit and where the Dewey Triangle lot is. Its 9 metered lots are live without it (ADR-0014). Not sent.
- [weehawken-parking-authority.md](weehawken-parking-authority.md): a request to Weehawken's Parking Authority (SRC-11) for its lots, hours, and rates, since Weehawken publishes no list. Not sent.

## jersey-city-parking-candidates.csv

For the Jersey City Parking Division (SRC-5): sites on public land that the State's tax records describe as parking, for the Division to confirm. Built on 2026-11-04.

- **Source:** NJOGIS, [Parcels and MOD-IV Composite of NJ](https://www.arcgis.com/home/item.html?id=533599bbfbaa4748bf39faf1375a8a9c), published 2026-08-24. NJOGIS asks to be credited for data derived from it (specs/06). Owner names are redacted in that layer, and none are in this file.
- **Selection:** Jersey City parcels (municipality 0906) in class 15C, public property, whose building description or facility name mentions parking: 139 parcels.
- **Sites:** parcels on one block whose outlines touch are one site: 73 sites.
- **Groups**, from what else is on each block (our own rough sort, not the city's):
  1. **Known public lot** (8): within 90 m of a lot in the city's [Municipal Parking Lots](https://data.jerseycitynj.gov/explore/dataset/municipal-parking-lots/) dataset (2020) or one of NJ Transit's two Jersey City lots. City Lots 3 and 49 share a site.
  2. **No obvious use** (25): nothing else on the block explains it. The likeliest to be city lots missing from the 2020 list.
  3. **Next to a school, public building, park, or church** (35): probably staff or visitor parking.
  4. **Railroad or right of way** (5).
- **Columns:** the site's addresses, block, and lots as written in the tax record; the assessor's description; other public uses on the block; the centre's coordinates and an OpenStreetMap link. The area column is the whole parcels' area, not just the parking. The last six columns are blank, for the Division to fill in: open to the public, operator, spaces, hours, rates, and notes.
- **Limits:** it misses public lots on land the city leases rather than owns, and lots whose description doesn't say parking. Garages are mostly missed, because "garage" on public land usually means a public works garage.
