# ADR-0007: Scope is public-agency parking, labeled by operator

- Status: Proposed (the scope was chosen by the user on 2026-11-03, PRD-1)
- Date: 2026-11-03

## Context

The original idea was "city-run" parking. The sources have a mix of operators. NYC DOT runs its own garages and fields. NJ Transit's lot database lists lots owned by municipalities (189), NJ Transit (168), both (28), private companies (32), and some with no owner recorded (72). NJDOT, the NYS Thruway, and the state park services run others.

## Options

1. City-run only: just facilities a city or municipality operates. Clear, but NJ coverage would be thin.
2. Any public agency (city, county, state, transit agency, or public authority), with every facility labeled by its operator and filterable.
3. Everything a public dataset lists, including private lots. More coverage, but we'd be showing private businesses' prices and rules from someone else's dataset.

## Decision

Option 2, as chosen by the user.

- Each facility has an `operator_name` and an `operator_type`: `municipal`, `county`, `state`, `transit_agency`, or `public_authority`.
- Facilities whose owner is recorded as private aren't shown, even when a public dataset lists them.
- The UI can filter by operator type, starting in slice 2, when the first non-municipal source arrives.

## Consequences

- Every source adapter maps its owner and operator fields to `operator_type`.
- Lots with no recorded owner need a rule before NJ Transit data is admitted (PRD-4).
