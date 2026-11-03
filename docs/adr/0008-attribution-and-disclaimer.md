# ADR-0008: Every result shows where it came from, and every page carries the disclaimer

- Status: Proposed
- Date: 2026-11-03

## Context

NYC Admin Code § 23-502(d) lets the City require an app to identify a dataset's source and version and describe any changes made. The NJDEP distribution agreement requires a specific credit line. NJ Transit asks for credit. Parking rules also change: a garage in our first source closes on 2026-12-01. A suggestion isn't a guarantee that a spot exists, is open, or is legal.

## Options

1. A single credits page and a disclaimer in the footer. Light, but a result on its own wouldn't say how old its data is.
2. Credits on each result (source and data date) plus a Sources page, with the disclaimer on every page.
3. Credits only where a publisher requires them. That leaves gaps that are easy to miss as sources are added.

## Decision

Option 2.

- The disclaimer is on every page (ATT-1). Its text is a marked placeholder in the message catalog until a lawyer provides the wording (PRD-2). We don't write legal text ourselves.
- Each facility in an API response carries its source IDs, the source's data date, and a link to the official page (ATT-2).
- A Sources page and `GET /api/sources` list each admitted source: publisher, dataset link, terms link, data date, and what we change (ATT-3). Where a publisher requires exact credit wording, it's stored with the source and shown as given.
- We don't use government seals or logos (the OPEN-NY terms forbid the State seal).

## Consequences

- Adding a source includes writing its credit entry and its description of our changes.
- Responses get slightly bigger.
- The disclaimer can't ship to the public until PRD-2 is answered.
