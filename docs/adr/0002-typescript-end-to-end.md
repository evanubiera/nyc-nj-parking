# ADR-0002: TypeScript end to end

- Status: Accepted (2026-11-03, by the user)
- Date: 2026-11-03

## Context

The app reads more than it writes. It has one main endpoint (recommendations), a sources list, a scheduled ingestion worker, and a web UI that has to work on phones. There are no accounts, payments, or user content.

## Options

1. Spring Boot + PostgreSQL/PostGIS with a React + TypeScript monorepo, as in the gear-rental project. The patterns are familiar, but it needs a JDK and Gradle and two languages for a small API.
2. TypeScript end to end: Node 24, Fastify for the API, a Node process for the worker, and React + Vite for the web app, all in one pnpm workspace.
3. Serverless functions with a hosted database. Little to run, but it ties the design to one host before hosting is decided (HOST-1).

## Decision

Option 2, as chosen by the user.

- Runtime: Node 24 LTS, TypeScript (strict), ES modules, and pnpm workspaces.
- API: Fastify 5 (apps/api).
- Worker: a plain Node process with a scheduler (apps/worker).
- Web: React 19 + Vite 8 (apps/web).
- Shared: packages/db (connection, migrations, test database) and packages/api-client (types generated from the contract).
- Tests: Vitest in every package.

## Consequences

- One language and one toolchain, from ingestion to UI.
- There's no framework that enforces module boundaries for us. The rule that the api and worker never import each other is enforced by lint (FND-6).
- We write a small migration runner and job runner ourselves instead of using framework features.
