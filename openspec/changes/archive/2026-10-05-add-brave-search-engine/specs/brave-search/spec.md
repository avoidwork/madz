## ADDED Requirements

### Requirement: Brave search engine implementation

The system SHALL implement a `searchWithBrave(apiKey, query, limit)` function that GETs `https://api.search.brave.com/res/v1/web/search` with an `X-Subscription-Token: <key>` header and params `{ q: query, count: limit }`, and SHALL map the response `web.results[].description` field to the normalized `description` field.

#### Scenario: Brave search builds the correct request
- **WHEN** `searchWithBrave` is invoked with an API key, query, and limit
- **THEN** it GETs `https://api.search.brave.com/res/v1/web/search` with `X-Subscription-Token: <key>` header and params `{ q: query, count: limit }`

#### Scenario: Brave search maps description to description
- **WHEN** the Brave API returns results with `web.results[].description` fields
- **THEN** `searchWithBrave` returns `{ ok: true, results }` where each result has `title`, `url`, and `description` (mapped from `web.results[].description`)

#### Scenario: Brave search returns an error on non-2xx response
- **WHEN** the Brave API returns a non-2xx status (e.g., 401 or 429)
- **THEN** `searchWithBrave` returns `{ ok: false, error }` with the status code

#### Scenario: Brave search returns empty results
- **WHEN** the Brave API returns an empty `web.results` array
- **THEN** `searchWithBrave` returns `{ ok: true, results: [] }`

### Requirement: Brave backend selection

The system SHALL include `"brave"` in the `detectSearchBackend()` explicit-engine list and inference chain, and SHALL wire a `case "brave"` into the `searchWebImpl()` switch.

#### Scenario: Brave is detected when engine is explicitly set
- **WHEN** `search.engine` is set to `"brave"`
- **THEN** `detectSearchBackend()` returns `"brave"`

#### Scenario: Brave is inferred from an API key
- **WHEN** `search.engine` is not set but `search.brave.apiKey` is configured
- **THEN** `detectSearchBackend()` returns `"brave"`

#### Scenario: Brave routes through searchWebImpl
- **WHEN** `search.engine` is `"brave"` and `searchWebImpl` is invoked with a query
- **THEN** it dispatches to `searchWithBrave` and returns normalized results with `backend: "brave"`

### Requirement: Brave API key plumbing

The system SHALL add `searchBraveApiKey: search?.brave?.apiKey` to `runtimeOptions` and SHALL include it in the `hasAnySearch` gate so the search tool is enabled when a Brave API key is configured.

#### Scenario: Brave API key is plumbed to runtimeOptions
- **WHEN** `search.brave.apiKey` is configured
- **THEN** `runtimeOptions.searchBraveApiKey` is set to that value

#### Scenario: Brave API key enables the search tool
- **WHEN** `search.brave.apiKey` is configured and no other search credentials are present
- **THEN** the `hasAnySearch` gate returns true
