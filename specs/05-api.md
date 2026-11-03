# 05 API

The contract is api/openapi.yaml (OpenAPI 3.1, ADR-0004). This page covers the conventions, the error codes, and the slice 1 operations, which are added to the contract in S1-1.

## Conventions

- Every path starts with `/api`. Bodies are JSON (`application/json`).
- Field names are camelCase, to match the TypeScript client (decided by the user on 2026-11-03; the original notes sketched snake_case, such as `lot_id`).
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

## Slice 1 operations

Reviewed by the user on 2026-11-03. They're added to api/openapi.yaml in S1-1.

### `getRecommendations`: `GET /api/parking/recommendations`

Parameters:

| Name | Type | Rules |
|---|---|---|
| `lat` | number | −90 to 90. Rounded to 3 decimal places by the server |
| `lng` | number | −180 to 180. Rounded the same way |
| `radius` | integer, meters | 100 to 10,000. Default 2,000 (PRD-5, decided) |
| `operatorType` | repeated code | Optional filter (from slice 2) |

Coverage area: latitude 38.9 to 41.4 and longitude −75.6 to −73.6, which covers NYC and NJ. Outside it, the server returns 422 `location.out_of_area`. Inside it, an area with no data gets an empty list. The box is a simplification: it also takes in nearby parts of Pennsylvania (including Philadelphia), New York State, and Connecticut, which get an empty list. Real boundaries can replace it once PRD-3 settles the coverage area.

Response, `200`:

```json
{
  "results": [
    {
      "id": "nyc-dot-avenue-m",
      "name": "Avenue M Municipal Parking Field",
      "kind": "field",
      "operator": { "name": "NYC Department of Transportation", "type": "municipal" },
      "address": { "line": "1624 Chestnut Avenue", "locality": "Brooklyn", "region": "NY" },
      "location": { "lat": 40.61877, "lng": -73.95869 },
      "distanceMeters": 340,
      "openingHours": null,
      "meteredHours": {
        "timeZone": "America/New_York",
        "periods": [
          { "days": ["mon", "tue", "wed", "thu", "fri", "sat"], "from": "07:00", "to": "22:00", "maxStayMinutes": 900, "vehicleClass": "passenger" }
        ],
        "sourceText": ["15HR Pas Mon-Sat 0700-2200"]
      },
      "rates": [],
      "officialUrl": "https://www.nyc.gov/html/dot/html/motorist/parkinglist.shtml",
      "sources": [
        { "id": "nyc-facdb-dot", "dataUpdatedAt": "2026-07-16T00:00:00Z" },
        { "id": "nyc-meters-offstreet", "dataUpdatedAt": "2026-11-02T00:00:00Z" }
      ]
    },
    {
      "id": "nyc-dot-delancey-essex",
      "name": "Delancey and Essex Municipal Parking Garage",
      "kind": "garage",
      "operator": { "name": "NYC Department of Transportation", "type": "municipal" },
      "address": { "line": "105 Essex Street", "locality": "Manhattan", "region": "NY" },
      "location": { "lat": 40.71936, "lng": -73.98829 },
      "distanceMeters": 1250,
      "openingHours": null,
      "meteredHours": null,
      "rates": [],
      "officialUrl": "https://www.nyc.gov/html/dot/html/motorist/parkinglist.shtml",
      "sources": [{ "id": "nyc-facdb-dot", "dataUpdatedAt": "2026-07-16T00:00:00Z" }]
    }
  ]
}
```

Distances above are made up. The other values come from the sources as checked on 2026-11-03 (the Facilities Database and the Avenue M meters).

- `meteredHours` is when payment is required at the meters, and the time limit, never opening hours (WEB-6). It's null when no meters data matches the facility.
- `openingHours` is null in slice 1, because no admitted source states opening hours (SRC-1). Its shape will be `{ timeZone, periods: [{ days, opens, closes }] }`.
- A facility with both null is still returned, with `officialUrl` (REC-6). The attended garages, such as Delancey and Essex, are like this in slice 1.

### `listSources`: `GET /api/sources`

Each admitted source has: `id`, `publisher`, `title`, `datasetUrl`, `termsUrl`, `creditText` (nullable), `modifications` (codes), and `dataUpdatedAt`.
