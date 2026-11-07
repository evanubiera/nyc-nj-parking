# ADR-0014: Sources with unstated terms can go live without asking first

- Status: Accepted (2026-11-06, by the user)
- Date: 2026-11-06
- Supersedes: the condition in ADR-0011 that the publisher has been asked before a source goes live

## Context

ADR-0011 lets a source whose terms are unstated go live as "Admitted, terms pending", once we've asked its publisher. West New York's Parking Utility page (SRC-10) states no terms; its adapter was built and held back until a drafted request was sent. The user asked to put it live without asking: they don't need permission, since a publisher that objected would say so.

## Decision

As the user decided, a source whose terms are unstated (no license, or only a liability disclaimer) can be admitted without asking its publisher first. The rest of ADR-0011 still holds:

- It's published openly, with no sign-in, key, or click-through agreement.
- Nothing published with it restricts reuse. Stated restrictions still block (SRC-1, SRC-4).
- We credit the publisher on every result and on the Sources page, link to its own page, and fetch at most once a day.
- If a publisher objects, or states terms we can't meet, the source comes out in the next change and its facilities are withdrawn (ING-8).

Asking is still worth doing for what it brings besides permission, such as a stable link, missing details, or corrections; drafted requests stay in docs/requests. Such a source's status in specs/06 is **Admitted, terms unstated**.

This is the user's decision to accept the risk that a publisher objects. It isn't a finding that reuse is allowed; a lawyer's view (LEG-1) can change it.

## Consequences

- West New York's lots (`wny-parking-lots`) go live now.
- The same reasoning would let NJ Transit's and NJDOT's lots (SRC-2, SRC-3) and Hoboken's garages (SRC-7) go live without their requests being sent. Each is switched on only when the user says so.
- SRC-10 no longer blocks anything.
