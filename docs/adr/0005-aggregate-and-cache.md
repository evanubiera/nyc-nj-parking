# ADR-0005: Aggregate and cache, and admit sources one at a time

- Status: Accepted (2026-11-03, by the user)
- Date: 2026-11-03

## Context

The data comes from public portals (Socrata, ArcGIS, OpenDataSoft) and city web pages. These have throttling, outages, schema changes, and terms that differ by publisher. Several sources we expected to use didn't exist or weren't usable when we opened them (specs/06-sources.md).

## Options

1. Call the upstream portals on each user request. The data is always current, but we inherit every outage and rate limit, and each user's location would reach third parties.
2. A scheduled worker pulls each source, keeps the raw snapshot, and normalizes it into one schema. The API reads only our database.
3. A manual import from files. Simple, but it goes stale without anyone noticing.

## Decision

Option 2.

- Only the worker calls upstream. No API request causes an upstream call (ING-1).
- Each run stores the raw response first, with its fetch time, hash, and size (ING-2). Then it normalizes the data and writes it in one transaction. If anything fails, nothing changes and the run is recorded as failed with a code (ING-3, ING-4). If the hash matches the last successful run, normalizing is skipped (ING-7).
- Records that disappear from a source are marked withdrawn and hidden, not deleted.
- A source is ingested only when its entry in specs/06-sources.md is marked Admitted (ING-6). Admission needs: the dataset ID or URL, format, fields and coordinates, update frequency, terms of use, and rate limits, all checked against the live source, plus no open terms question for that source.

## Consequences

- Data is only as fresh as each source's schedule. The UI shows each source's "as of" date (ATT-2).
- Each source needs its own adapter, with tests from saved fixtures.
- Snapshots take storage, so slice 1 adds a retention rule.
