# ADR-0011: Sources with unstated terms can be used while we ask

- Status: Accepted (2026-11-03, by the user)
- Date: 2026-11-03
- Supersedes: one admission condition in ADR-0005 ("no open terms question for that source"), for sources whose terms are unstated

## Context

ADR-0005 admits a source only when its terms are known. The best New Jersey sources state none: NJ Transit's Parking Lot Database gives no license or terms (SRC-2), and NJDOT's park-and-ride layer gives only a liability disclaimer (SRC-3). Both are published openly on ArcGIS, with no sign-in or key. We drafted requests asking both publishers for their terms. Until they answer, ADR-0005 blocks slice 2. The user asked to override that rule.

## Options

1. Keep the rule, and wait for the publishers to answer.
2. Allow a source whose terms are unstated while our request is pending, with conditions, and remove it if the publisher objects.
3. Drop the terms check for every source.

## Decision

Option 2, as chosen by the user. A source can be marked **Admitted, terms pending** in specs/06-sources.md when all of these hold:

- It's published openly, with no sign-in, key, or click-through agreement.
- Nothing published with it restricts reuse. A liability disclaimer alone isn't a restriction. "All rights reserved", a no-redistribution clause, or conditions we can't meet are restrictions, and the source stays Blocked. SRC-1 (the nyc.gov DOT page) and SRC-4 (NJDEP's distribution agreement) are unchanged by this ADR.
- We've asked the publisher for its terms, and the open question stays open with the date we asked.
- We credit the publisher on every result and on the Sources page (ADR-0008), link to its own pages, and fetch at most once a day.

If a publisher objects, or answers with terms we can't meet, the source comes out of the registry in the next change, and its facilities are withdrawn (ING-8).

This is the user's decision to accept the risk that a publisher objects. It isn't a finding that reuse is allowed. A lawyer's view (LEG-1) can change it.

## Consequences

- Slice 2 can start before NJ Transit and NJDOT answer. PRD-4 (lots with no recorded owner) still has to be decided before NJ Transit's lots are shown.
- SRC-2 and SRC-3 stay open, and their answers can still remove those sources.
- Each Admitted, terms pending source needs a note in specs/06 saying when we asked, so it can be followed up.
