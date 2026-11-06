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
| [0011](0011-sources-with-unstated-terms.md) | Sources with unstated terms can be used while we ask | Accepted |
| [0012](0012-unconfirmed-sites-from-tax-records.md) | Jersey City's lots without hours or rates, and unconfirmed sites from tax records | Accepted |
| [0013](0013-address-search.md) | Address search with the NYC and NJ government geocoders | Accepted |
