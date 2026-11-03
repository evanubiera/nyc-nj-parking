# ADR-0010: `pnpm dev` works without Docker, and loads data on its first start

- Status: Accepted (2026-11-03, by the user)
- Date: 2026-11-03
- Supersedes: the local-development part of ADR-0003 ("Locally, the database runs in Docker Desktop from compose.yaml")

## Context

ADR-0003 made Docker Desktop the local database. Docker isn't installed on this Mac, so `pnpm dev` stopped at its first step. Even with Docker, it started an empty database: nothing loaded the parking data, so every search said no parking was found until someone ran `pnpm ingest` by hand. The user asked for `pnpm dev` to work without Docker and to load the data.

## Options

1. Keep Docker required, and document the `pnpm ingest` step. This needs no code, but `pnpm dev` stays unusable here until Docker is installed.
2. `pnpm dev` uses Docker when it's running, and otherwise PGlite with PostGIS, which the tests already use as their fallback. It's kept in a folder so data survives restarts, on the same port, so nothing else changes. On the first start, it loads each admitted source.
3. A separate command for development without Docker. That means two ways to start the app, and the plain `pnpm dev` still fails here.

## Decision

Option 2. `pnpm dev` (scripts/dev.ts):

- Uses a database already listening on the `DATABASE_URL` port. Otherwise it uses Docker's PostGIS if Docker is running, and otherwise starts PGlite with PostGIS saved in `.data/pglite`, which git ignores. `DEV_DATABASE=docker` or `DEV_DATABASE=pglite` overrides the choice.
- Applies the migrations.
- If there are no active facilities, it loads each admitted source through the worker's own code. If a source can't be reached, it loads that source's saved copy from the test fixtures and says so; that copy carries its real data date.
- Starts the API and the web app. Ctrl-C stops everything, including PGlite.

## Consequences

- `pnpm dev` works on a fresh clone with no Docker and no `.env`.
- PGlite has one backend behind its socket. That's fine for one developer, but it isn't for production or load tests. CI and deployment still use real PostgreSQL with PostGIS (ADR-0003 is unchanged for those), and only a test that passes on real PostGIS counts.
- Data from an earlier start stays until `pnpm ingest <source-id>` refreshes it or `.data/` is deleted.
