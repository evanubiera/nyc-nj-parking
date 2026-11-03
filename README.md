# NYC and NJ public parking

A public web app, usable on phones, that suggests public parking near you across New York City and New Jersey: garages, lots, and fields run by cities, counties, the state, and transit agencies. A scheduled worker pulls open data into PostgreSQL/PostGIS, and the API answers from that database only.

Status: slice 0 (foundation). Nothing user-facing yet. See [specs/01-overview.md](specs/01-overview.md) for the slices, and [specs/06-sources.md](specs/06-sources.md) for what each data source actually contains.

## Run it

Needs Node 24 (`corepack enable` picks up the pinned pnpm) and Docker Desktop.

```bash
pnpm install
cp .env.example .env
pnpm dev        # PostGIS in Docker on port 5434, migrations, API on :8180, web app on :5180
```

## Check it

```bash
pnpm lint       # contract lint, then ESLint
pnpm typecheck
pnpm test       # database tests use TEST_DATABASE_URL, or an in-process PGlite with PostGIS if it isn't set
pnpm build
```

To run the database tests against real PostGIS locally, start the database with `docker compose up -d`, create a separate test database, and set `TEST_DATABASE_URL` to it. Tests empty the tables they use, so never point it at your development database.

## Where things are

| Path | What |
|---|---|
| `api/openapi.yaml` | The API contract. Routes and types come from it. |
| `apps/api` | Fastify API |
| `apps/worker` | Scheduled ingestion, and `pnpm ingest <source>` |
| `apps/web` | React + Vite web app |
| `packages/db` | Connection, migrations, and the test database |
| `packages/api-client` | Types generated from the contract, plus the client |
| `specs/` | Requirements, data model, architecture, API, sources, and tasks |
| `docs/adr/` | Decisions |
| `docs/open-questions.md` | What's still unknown, by ID |

No license has been chosen for this code yet.
