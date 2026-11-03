# ADR-0003: PostgreSQL with PostGIS as the only data store

- Status: Accepted (2026-11-03, by the user)
- Date: 2026-11-03

## Context

The main query is "public facilities within a radius of a point, nearest first". Sources provide points (meters, NYC Facilities Database) and polygons (NJ Transit lots). We also keep raw snapshots of what each source returned.

## Options

1. PostgreSQL + PostGIS: proper distance and radius queries on a geography type with a GiST index, and polygons as well as points.
2. SQLite + SpatiaLite: one file and easy to ship, but weaker for concurrent writes from the worker while the API reads.
3. An in-memory spatial index loaded from files: fast, but every new kind of query means new code, and there's no transaction boundary for ingestion.

## Decision

Option 1. We use PostgreSQL 18 with PostGIS 3.6 (`postgis/postgis:18-3.6`). Facility locations are stored as `geography(Point, 4326)` with a GiST index, and lot outlines, when we keep them, as `geography(MultiPolygon, 4326)`.

Locally, the database runs in Docker Desktop from compose.yaml. Database tests run against `TEST_DATABASE_URL` when it's set, which is what CI does. It's a separate variable from `DATABASE_URL` because tests empty their tables. When it isn't set, they fall back to PGlite with its PostGIS extension, in-process, so they can run on a machine without Docker.

## Consequences

- Docker Desktop is needed for `pnpm dev`.
- The PGlite fallback has known gaps: a single connection, and some server features are missing. CI always uses real PostGIS, so a test that passes only on PGlite doesn't count.
- Schema changes are plain numbered SQL migrations (FND-5).
