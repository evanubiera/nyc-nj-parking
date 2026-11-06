# ADR-0013: Address search with the NYC and NJ government geocoders

- Status: Accepted (2026-11-06, by the user)
- Date: 2026-11-06
- Decides: VEN-1

## Context

The user asked for a search box that takes a town ("Hoboken, NJ") or an address ("174 Newark Ave, Jersey City, NJ") and suggests matches as people type. Until now, people could search only from their device's location or by tapping the map. Whatever someone types says where they're going, so it's location data (ADR-0006), and suggesting as they type means sending it somewhere on each pause.

Checked on 2026-11-06:

- **Nominatim**, OpenStreetMap's public geocoder: its [usage policy](https://operations.osmfoundation.org/policies/nominatim/) forbids autocomplete.
- **Photon** (komoot), built on OpenStreetMap: free on a fair-use basis, covers both states, and allows browsers to call it. In a test it ranked "681-685 Newark Ave" first for "174 Newark Ave Jersey".
- **[NYC GeoSearch](https://labs-geosearch-docs.netlify.app/)**, run by NYC Planning on the City's Property Address Directory: autocompletes New York City addresses, allows browsers to call it, and needs no key. It doesn't know towns or neighbourhoods as places.
- **[NJ_Geocode](https://www.nj.gov/njgin/edata/geocoding/)**, run by the State's Office of GIS: suggests and locates New Jersey addresses (its data are updated monthly), allows browsers to call it, and needs no key. It returns nothing for a town name alone.
- Commercial geocoders need a key, cost money, and limit how results may be kept; their terms may depend on PRD-6.

## Decision

The government geocoders, as chosen by the user.

- **Towns and neighbourhoods** come from a list built into the web app, matched in the browser, so typing a town sends nothing anywhere: New Jersey's 564 municipalities from NJOGIS's Municipal Boundaries of NJ, and New York City's boroughs and neighbourhood names from the City's 2020 Neighborhood Tabulation Areas, each at the centre of its area. `scripts/build-places.ts` rebuilds the list.
- **Addresses** (text that starts with a number) go to NYC GeoSearch when the text names New York or a borough, to NJ_Geocode when it names New Jersey or a New Jersey town, and to both when it names neither.
- The web app's services call the geocoders directly from the browser (WEB-3). Our API never does (ING-1), so the typed text never reaches our servers.
- The typed text is never stored, logged, or put in a URL of ours (PRIV-1, PRIV-5). It's sent only after a pause in typing and at least three characters, and suggestions are cached in memory only.
- The chosen point is rounded to 3 decimal places before searching (PRIV-3).
- A line under the suggestions credits both geocoders.

## Consequences

- VEN-1 is decided. The privacy notice (LEG-1) has to say that typed addresses go to the NYC and NJ government geocoders.
- Address search depends on two services we don't run. If they're down, towns, the device's location, and the map still work.
- The smoke test stubs both geocoders.
- Neighbourhood names outside New York City aren't in the list; a New Jersey town works, and an address works anywhere in either state.
