# ADR-0009: Map tiles from our own hosting, with OpenFreeMap until then

- Status: Accepted (2026-11-03, by the user)
- Date: 2026-11-03
- Answers: SRC-6

## Context

S1-9b adds a map to the search page. A map needs basemap tiles: streets, water, and labels. Every option we found is built on OpenStreetMap data, which is under the ODbL. The map has to credit "OpenStreetMap" and make clear the data is available under the ODbL, normally in a corner of the map ([copyright](https://www.openstreetmap.org/copyright), [attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)).

Tiles bring a privacy question that ADR-0006 doesn't cover. Whoever serves the tiles receives a request for each tile of the area on screen, plus the visitor's IP address. That's a coarser location than the rounded point our API gets, but it is a location.

## Options

Checked against each provider's own pages on 2026-11-03 (details in the shared research note `parking-src-6-map-tiles.md`):

1. **OpenStreetMap Foundation tiles** ([policy](https://operations.osmfoundation.org/policies/tiles/)). Free, but "best-effort" with no SLA, can block an app without notice, and warns services that "access may be withdrawn at any point". Not suitable.
2. **OpenFreeMap public instance** ([site](https://openfreemap.org/), [terms](https://openfreemap.org/tos/), [privacy](https://openfreemap.org/privacy/)). Free with no request limits, commercial use allowed, no API keys or cookies, and no IP addresses in access logs. But there's no service guarantee, it "may discontinue it at any time without notice", it may use Cloudflare, and its terms are under Hungarian law.
3. **NYC City map tiles** ([page](https://maps.nyc.gov/tiles/)). CC BY 4.0, but not usable now: the old address says the service moved, and the new portal says the API doesn't exist. It covers NYC only.
4. **Protomaps, self-hosted** ([downloads](https://docs.protomaps.com/basemaps/downloads), [licence](https://github.com/protomaps/basemaps/blob/main/LICENSE.md)). One PMTiles file cut to NYC and NJ from the daily planet build, served from our own storage. The code is BSD-3, the styles are CC0, and the data is ODbL, so only OpenStreetMap credit is required. No fees beyond storage and bandwidth, and no third party sees what people look at. Needs hosting with HTTP range requests (HOST-1) and a refresh job.
5. **Hosted commercial providers**: the [Protomaps API](https://protomaps.com/api), [Stadia Maps](https://stadiamaps.com/pricing), [MapTiler](https://www.maptiler.com/cloud/pricing/), and [Mapbox](https://www.mapbox.com/pricing). Their free plans exclude commercial use (Mapbox's doesn't, but it's priced per load of its own library rather than MapLibre). Paid plans start at $20–30 a month or per-load fees. All need API keys, and all receive every tile request.

## Decision

- **Production:** option 4, self-hosted Protomaps PMTiles for NYC and NJ, served from our own hosting once HOST-1 is decided, with the glyphs and sprites hosted alongside.
- **Until then (development and previews):** option 2, OpenFreeMap's public instance.
- The web app reads the map style from configuration (`VITE_MAP_STYLE_URL`), so moving from one to the other is a setting, not a code change.
- The map shows the attribution its style requires, including "© OpenStreetMap" with a link to the licence (WEB-7).

## Consequences

- The map can be built now (S1-9b) against OpenFreeMap.
- Public launch needs the self-hosted tiles, which is one more reason it waits on HOST-1. OpenFreeMap isn't used for the public app (PRIV-4).
- Our hosting's logs then have to drop tile paths, because `/{z}/{x}/{y}` reveals the area viewed, just as they drop query strings (ADR-0006, HOST-1).
- Someone has to refresh the NYC and NJ extract on a schedule, roughly monthly, so new streets appear. The extract size, and so the storage cost, is still to be measured.
- Whether the app is commercial (PRD-6) no longer decides the tile provider, because both chosen options allow commercial use. It still matters for any other free tier we consider later.
