# ADR-0001: Spec-first delivery in thin vertical slices

- Status: Proposed
- Date: 2026-11-03

## Context

The app suggests public parking near the user in New York and New Jersey. Most candidate data sources turned out to be different from what we expected (specs/06-sources.md), and the terms for several are still open. We need something usable early, and we need to add sources one at a time as each is verified.

## Options

1. Build ingestion for every source first, then the API, then the UI. Nothing is usable until the end, and unverified sources would shape the schema.
2. Thin vertical slices: each slice goes from one or two sources to a screen someone can use. Specs and the API contract change first, in the same change as the code.
3. Prototype without specs and write them later. This is fast at first, but the source rules and privacy rules end up living only in code.

## Decision

Option 2. Each slice starts from tasks in specs/10-task-breakdown.md and the requirement IDs they list. When behavior changes, the specs and api/openapi.yaml change in the same commit as the code. Tests are named after requirement IDs. Unknowns are tracked by ID in docs/open-questions.md, and nothing legal or contractual is invented in their place.

## Consequences

- Early slices cover a small area (slice 1 is NYC DOT facilities only).
- The facility schema will grow as sources are added, so migrations are expected.
- The specs have to be kept current, because they are what we review against.
