# CLAUDE.md

A public web app, usable on phones, that suggests public parking near the user across New York City and New Jersey. It's built spec-first, in thin vertical slices (ADR-0001).

## Read first
- `specs/01-overview.md`: scope, users, slices, and the spec index.
- `specs/02-requirements.md`: requirements and their IDs (`ING-3`, `PRIV-2`, …).
- `specs/06-sources.md`: every data source, verified, with its status. Only **Admitted** sources are ingested.
- `specs/10-task-breakdown.md`: the tasks for the current slices.
- `docs/adr/`: why things are built the way they are. Accepted ADRs aren't rewritten; changing a decision takes a new ADR.
- `docs/open-questions.md`: what's still unknown, by ID.
- `api/openapi.yaml`: the API contract. The server's routes and the TypeScript types come from it.

## How to work
1. Start from a task in `specs/10-task-breakdown.md` and the requirement IDs it lists.
2. When behavior changes, update the specs and `api/openapi.yaml` in the same change as the code.
3. Name tests after requirement IDs, for example `PRIV-2 request logs never contain the query string`.
4. Never invent legal, licensing, terms-of-use, or disclaimer text. Use a clearly marked placeholder and the open question's ID.
5. If a spec and an ADR disagree, stop and point it out instead of picking one.
6. Before using a new data source, open it and record in `specs/06-sources.md`: its ID or URL, format, fields and coordinates, update frequency, terms, and rate limits. Don't build on a claim you haven't checked.

## Rules that must never be broken
1. **Users' locations** are never stored or logged. The web app rounds coordinates to 3 decimal places, and the API rounds again. Request logs never contain the URL, the query string, or the body. (ADR-0006, PRIV-1 to PRIV-3)
2. **No upstream calls during a request.** Only the worker calls upstream portals. (ADR-0005, ING-1)
3. **Only Admitted sources** in `specs/06-sources.md` are ingested. A source with unstated terms can be Admitted, terms pending while we ask its publisher; a source with stated restrictions can't. (ING-6, ADR-0011)
4. **A failed ingestion run changes no facility data.** Normalizing and writing happen in one transaction. (ING-3)
5. **Every facility shown carries its source and data date**, and every page shows the disclaimer. (ADR-0008, ATT-1, ATT-2)
6. **Private facilities** (owner recorded as private) aren't shown. Every facility has an operator name and type. (ADR-0007)
7. **The API returns no display text.** Errors carry a `code`. The web app has no literal strings in JSX; text comes from the message catalog. (ADR-0004, FND-4, WEB-1)
8. **Front-end layers:** components → hooks → services → `packages/api-client`. Only services call the network; MapLibre loading map tiles is the one exception, and it never calls our API. (WEB-3, ADR-0009)
9. **apps/api and apps/worker never import each other.** Shared code goes in `packages/`. (FND-6)
10. **Generated code is never edited by hand.** Change `api/openapi.yaml` and regenerate. (ADR-0004)
11. **Money** is minor units plus a currency, never a float. **Time** is stored in UTC; opening hours are local wall-clock times with the facility's time zone. (specs/03)
12. **Worker logs** never contain request headers (the Socrata token) or response bodies. (ING-5)
13. **String arrays in SQL** go through `textArray` from `@parking/db`. postgres.js sends an untyped string array as plain text in a connection's first query. Lint enforces this.

## Commands
Needs Node 24 with `corepack enable` (for the pinned pnpm). Docker Desktop is optional: without it, `pnpm dev` uses PGlite (ADR-0010).

```bash
pnpm install          # dependencies; also generates packages/api-client from the contract
pnpm dev              # database on 5434 (Docker, or PGlite in .data/), migrations, data on first start, then the API (:8180) and the web app (:5180)
pnpm test             # Vitest in every package (database tests use TEST_DATABASE_URL, or PGlite if it isn't set)
pnpm test:e2e         # Playwright smoke test on an emulated phone; starts its own stack from the saved fixtures
pnpm lint             # contract lint, then ESLint everywhere
pnpm typecheck        # tsc in every package
pnpm build            # every package
pnpm api:generate     # regenerate packages/api-client after editing api/openapi.yaml
pnpm db:migrate       # apply migrations to DATABASE_URL
pnpm ingest <source>  # run one admitted source once
```
