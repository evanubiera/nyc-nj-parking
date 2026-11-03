# ADR-0006: Users' locations are rounded and never stored or logged

- Status: Proposed
- Date: 2026-11-03

## Context

To suggest parking, the app needs to know roughly where the user is. A precise location linked to a time is sensitive personal data, and the app is public and has no accounts. The recommendations endpoint is `GET` with `lat` and `lng` in the query string, which proxies and load balancers usually log.

## Options

1. Send exact coordinates and rely on not logging them. One misconfigured proxy would record exact locations.
2. Round on the device before sending, round again on the server, and never log or store coordinates or query strings.
3. Send only a coarse area ID, such as a grid cell. Most private, but "nearest" becomes inaccurate, and it adds a scheme to maintain.

## Decision

Option 2.

- The web app rounds latitude and longitude to 3 decimal places (about 110 m north–south and 85 m east–west here) before sending them. The API rounds again before using them (PRIV-3).
- No table stores request coordinates or place-search text (PRIV-1).
- Request logs record the method, route pattern, status, and duration, never the URL or the query string (PRIV-2). Hosting must also drop query strings from load balancer and CDN logs (HOST-1).
- Responses don't echo the request coordinates.
- There are no accounts, and no analytics tied to location.

## Consequences

- Distances can be off by up to about 70 m. That's acceptable for "parking near me".
- Bugs involving a specific location have to be reproduced from a description, not from logs.
- Every new log statement and endpoint has to follow these rules. Tests check the request logs (PRIV-2).
