# 05 API

The contract is api/openapi.yaml (OpenAPI 3.1, ADR-0004). This page covers the conventions, the error codes, and the slice 1 draft, which isn't in the contract yet.

## Conventions

- Every path starts with `/api`. Bodies are JSON (`application/json`).
- Field names are camelCase. The original notes sketched snake_case (`lot_id`); we use camelCase to match the TypeScript client.
- No display text (FND-4). Enumerations are codes (`kind: "garage"`), and the web app turns them into text.
- Errors: status code plus `{ "code": "…" }`. The body can carry `parameter` (the name of the bad parameter) and nothing else.
- Distances are integers in meters. Money is `{ "amountMinor": 400, "currency": "USD" }`. Times of day are `"HH:MM"` local to the facility, with its `timeZone`. Instants are RFC 3339 in UTC.
- Responses never echo the caller's coordinates (PRIV-3).

## Error codes

| Code | Status | When |
|---|---|---|
| `request.malformed` | 400 | The request can't be parsed |
| `request.invalid_parameter` | 400 | A parameter is missing, the wrong type, or out of range. `parameter` names it |
| `not_found` | 404 | No such path |
| `method_not_allowed` | 405 | The path exists, but not with this method |
| `location.out_of_area` | 422 | The point is outside the coverage area (slice 1) |
| `internal_error` | 500 | Anything unexpected |
| `service_unavailable` | 503 | The database isn't reachable |

## Slice 0 operations

| Operation | Path | Requirements |
|---|---|---|
| `getHealth` | `GET /api/health` | FND-3 |

`200 { "status": "ok" }` when the database answers `select 1` within 2 seconds, otherwise `503 { "status": "unavailable" }`.

## Slice 1 draft, for review

### `getRecommendations`: `GET /api/parking/recommendations`

Parameters:

| Name | Type | Rules |
|---|---|---|
| `lat` | number | −90 to 90. Rounded to 3 decimal places by the server |
| `lng` | number | −180 to 180. Rounded the same way |
| `radius` | integer, meters | 100 to 10,000. Default 2,000 (PRD-5) |
| `operatorType` | repeated code | Optional filter (from slice 2) |

Coverage area: latitude 38.9 to 41.4 and longitude −75.6 to −73.6, which covers NYC and NJ. Outside it, the server returns 422 `location.out_of_area`. Inside it, an area with no data gets an empty list.

Response, `200`:

```json
{
  "results": [
    {
      "id": "nyc-dot-delancey-essex",
      "name": "Delancey and Essex Municipal Parking Garage",
      "kind": "garage",
      "operator": { "name": "NYC Department of Transportation", "type": "municipal" },
      "address": { "line": "105 Essex Street", "locality": "Manhattan", "region": "NY" },
      "location": { "lat": 40.71936, "lng": -73.98829 },
      "distanceMeters": 120,
      "hours": {
        "timeZone": "America/New_York",
        "periods": [{ "days": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], "opens": "00:00", "closes": "24:00" }],
        "sourceText": null
      },
      "rates": [],
      "officialUrl": "https://www.nyc.gov/html/dot/html/motorist/parkinglist.shtml",
      "sources": [{ "id": "nyc-facdb-dot", "dataUpdatedAt": "2026-07-16T00:00:00Z" }]
    }
  ]
}
```

The values above illustrate the shape only. The hours shown aren't taken from any source.

### `listSources`: `GET /api/sources`

Each admitted source has: `id`, `publisher`, `title`, `datasetUrl`, `termsUrl`, `creditText` (nullable), `modifications` (codes), and `dataUpdatedAt`.
