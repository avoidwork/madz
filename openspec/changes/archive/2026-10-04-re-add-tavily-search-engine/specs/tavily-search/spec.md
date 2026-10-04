## ADDED Requirements

### Requirement: Tavily search engine implementation

The system SHALL implement a `searchWithTavily(apiKey, query, limit)` function that POSTs to `https://api.tavily.com/search` with `Authorization: Bearer <key>` and a JSON body of `{ query, search_depth: "basic", max_results: limit }`, and SHALL map the response `results[].content` field to the normalized `description` field.

#### Scenario: Tavily search builds the correct request
- **WHEN** `searchWithTavily` is invoked with an API key, query, and limit
- **THEN** it POSTs to `https://api.tavily.com/search` with `Authorization: Bearer <key>` header and a JSON body of `{ query, search_depth: "basic", max_results: limit }`

#### Scenario: Tavily search maps content to description
- **WHEN** the Tavily API returns results with `content` fields
- **THEN** `searchWithTavily` returns `{ ok: true, results }` where each result has `title`, `url`, and `description` (mapped from `content`)

#### Scenario: Tavily search returns an error on non-2xx response
- **WHEN** the Tavily API returns a non-2xx status (e.g., 401 or 429)
- **THEN** `searchWithTavily` returns `{ ok: false, error }` with the status code

#### Scenario: Tavily search returns empty results
- **WHEN** the Tavily API returns an empty `results` array
- **THEN** `searchWithTavily` returns `{ ok: true, results: [] }`

### Requirement: Tavily backend selection

The system SHALL include `"tavily"` in the `detectSearchBackend()` explicit-engine list and inference chain, and SHALL wire a `case "tavily"` into the `searchWebImpl()` switch.

#### Scenario: Tavily is detected when engine is explicitly set
- **WHEN** `search.engine` is set to `"tavily"`
- **THEN** `detectSearchBackend()` returns `"tavily"`

#### Scenario: Tavily is inferred from an API key
- **WHEN** `search.engine` is not set but `search.tavily.apiKey` is configured
- **THEN** `detectSearchBackend()` returns `"tavily"`

#### Scenario: Tavily routes through searchWebImpl
- **WHEN** `search.engine` is `"tavily"` and `searchWebImpl` is invoked with a query
- **THEN** it dispatches to `searchWithTavily` and returns normalized results with `backend: "tavily"`
