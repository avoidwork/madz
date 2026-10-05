## ADDED Requirements

### Requirement: Firecrawl search engine implementation

The system SHALL implement a `searchWithFirecrawl(apiKey, query, limit)` function that POSTs to `https://api.firecrawl.dev/v2/search` with `Authorization: Bearer <key>` and a JSON body of `{ query, limit, sources: ["web"] }`, and SHALL map the response `data.web[].description` field to the normalized `description` field.

#### Scenario: Firecrawl search builds the correct request
- **WHEN** `searchWithFirecrawl` is invoked with an API key, query, and limit
- **THEN** it POSTs to `https://api.firecrawl.dev/v2/search` with `Authorization: Bearer <key>` header and a JSON body of `{ query, limit, sources: ["web"] }`

#### Scenario: Firecrawl search maps description to description
- **WHEN** the Firecrawl API returns results with `data.web[].description` fields
- **THEN** `searchWithFirecrawl` returns `{ ok: true, results }` where each result has `title`, `url`, and `description` (mapped from `data.web[].description`)

#### Scenario: Firecrawl search returns an error on non-2xx response
- **WHEN** the Firecrawl API returns a non-2xx status (e.g., 401, 408, or 500)
- **THEN** `searchWithFirecrawl` returns `{ ok: false, error }` with the status code

#### Scenario: Firecrawl search returns empty results
- **WHEN** the Firecrawl API returns an empty `data.web` array
- **THEN** `searchWithFirecrawl` returns `{ ok: true, results: [] }`

#### Scenario: Firecrawl search clamps the limit
- **WHEN** `searchWithFirecrawl` is invoked with a limit outside 1–100
- **THEN** the request body `limit` is clamped to the 1–100 range

### Requirement: Firecrawl backend selection

The system SHALL include `"firecrawl"` in the `detectSearchBackend()` inference chain, and SHALL wire a `case "firecrawl"` into the `searchWebImpl()` switch.

#### Scenario: Firecrawl is inferred from an API key
- **WHEN** `search.firecrawl.apiKey` is configured
- **THEN** `detectSearchBackend()` returns `"firecrawl"`

#### Scenario: Firecrawl routes through searchWebImpl
- **WHEN** the detected backend is `"firecrawl"` and `searchWebImpl` is invoked with a query
- **THEN** it dispatches to `searchWithFirecrawl` and returns normalized results with `backend: "firecrawl"`
