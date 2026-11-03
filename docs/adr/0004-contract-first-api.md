# ADR-0004: Contract-first API, with codes instead of display text

- Status: Accepted (2026-11-03, by the user)
- Date: 2026-11-03

## Context

The web app and, later, possibly a native app call the API. Its responses must never carry fields we didn't mean to expose; in particular, nothing about the caller's location (ADR-0006).

## Options

1. Write routes in code and generate the OpenAPI document from them. Quick, but the contract follows whatever the code does.
2. Write api/openapi.yaml first. The server registers routes from it, validates requests and responses against it, and the TypeScript types are generated from it.
3. No formal contract, only shared TypeScript types. This doesn't serve a future native app, and nothing is validated at runtime.

## Decision

Option 2.

- api/openapi.yaml (OpenAPI 3.1) is the source of truth. It's linted with Redocly, and every operation lists its requirement IDs in `x-requirements` (FND-1).
- The API registers exactly the contract's operations through fastify-openapi-glue, and validates requests and serializes responses with the contract's schemas, so fields that aren't in a response schema are dropped (FND-2).
- packages/api-client generates types with openapi-typescript and wraps openapi-fetch. Generated files aren't edited by hand.
- The API returns no display text. Errors are `{ "code": "…" }`, with codes listed in specs/05-api.md (FND-4). The web app turns codes into text from its message catalogs (WEB-1).

## Consequences

- Every new endpoint starts with a change to the contract and the specs.
- Response schemas need care: a field left out of the schema is silently dropped.
- Translations can be added later without changing the API.
