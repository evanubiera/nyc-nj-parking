# Architecture decision records

Each ADR records one decision: the context, the options, the choice, and what follows from it. An Accepted ADR isn't rewritten. To change a decision, write a new ADR that supersedes it. Use template.md for new ones.

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-spec-first-thin-slices.md) | Spec-first delivery in thin vertical slices | Accepted |
| [0002](0002-typescript-end-to-end.md) | TypeScript end to end (Fastify, React + Vite, pnpm) | Accepted |
| [0003](0003-postgresql-postgis.md) | PostgreSQL with PostGIS as the only data store | Accepted; local development superseded by 0010 |
| [0004](0004-contract-first-api.md) | Contract-first API, with codes instead of display text | Accepted |
| [0005](0005-aggregate-and-cache.md) | Aggregate and cache, and admit sources one at a time | Accepted; terms condition relaxed by 0011 |
| [0006](0006-user-location-privacy.md) | Users' locations are rounded and never stored or logged | Accepted |
| [0007](0007-public-agency-scope.md) | Scope is public-agency parking, labeled by operator | Accepted; amended by 0012 for unconfirmed sites |
| [0008](0008-attribution-and-disclaimer.md) | Every result shows where it came from, and every page carries the disclaimer | Accepted |
| [0009](0009-map-tiles.md) | Map tiles from our own hosting, with OpenFreeMap until then | Accepted |
| [0010](0010-local-dev-without-docker.md) | `pnpm dev` works without Docker, and loads data on its first start | Accepted |
| [0011](0011-sources-with-unstated-terms.md) | Sources with unstated terms can be used while we ask | Accepted; the ask-first condition superseded by 0014 |
| [0012](0012-unconfirmed-sites-from-tax-records.md) | Jersey City's lots without hours or rates, and unconfirmed sites from tax records | Accepted; extended to all of Hudson County by 0015 |
| [0013](0013-address-search.md) | Address search with the NYC and NJ government geocoders | Accepted |
| [0014](0014-unstated-terms-without-asking.md) | Sources with unstated terms can go live without asking first | Accepted |
| [0015](0015-hudson-county.md) | The rest of Hudson County: Hoboken's garages, and unconfirmed sites in every town | Accepted |
| [0016](0016-ordinance-as-a-source.md) | A city ordinance as a source, checked by its file's hash | Accepted |
| [0017](0017-sites-not-for-visitors.md) | Unconfirmed sites a town says aren't for visitors are left out | Accepted |
