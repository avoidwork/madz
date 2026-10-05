## ADDED Requirements

### Requirement: Exa search engine config schema

The system SHALL declare an `ExaSearchSchema` with an `apiKey` field and SHALL add `exa` to the `SearchConfigSchema` and the `engine` enum.

#### Scenario: Exa schema declares apiKey
- **WHEN** `SearchConfigSchema` is inspected
- **THEN** it contains an `exa` sub-schema with an `apiKey` field that defaults to `""`

#### Scenario: Exa is a valid engine value
- **WHEN** `search.engine` is set to `"exa"`
- **THEN** the config validates without error

### Requirement: Exa search engine implementation

The system SHALL implement a `searchWithExa(apiKey, query, limit)` function that POSTs to `https://api.exa.ai/search` with an `x-api-key` header and body `{ query, type: "auto", numResults: limit }`, and SHALL map `results[].text` or `results[].highlights[0]` to the normalized `description` field.

#### Scenario: Exa search returns results
- **WHEN** `searchWithExa` is invoked with an apiKey, query, and limit
- **THEN** it returns `{ ok: true, results }` with title, url, and description fields

#### Scenario: Exa search maps highlights fallback
- **WHEN** a result has no `text` but has `highlights[0]`
- **THEN** the `description` field is populated from `highlights[0]`

#### Scenario: Exa search fails with an error status
- **WHEN** the Exa request returns a 401, 402, or 429 status
- **THEN** it returns `{ ok: false, error }`

#### Scenario: Exa search returns empty results
- **WHEN** the Exa request returns no results
- **THEN** it returns `{ ok: true, results: [] }`

### Requirement: Exa backend selection

The system SHALL include `"exa"` in the `detectSearchBackend` explicit-engine list and the inference chain (`search?.exa?.apiKey`), and SHALL wire a `case "exa"` into the `searchWebImpl()` switch.

#### Scenario: Explicit engine selects Exa
- **WHEN** `search.engine` is set to `"exa"`
- **THEN** `detectSearchBackend()` returns `"exa"`

#### Scenario: Inference selects Exa when apiKey is configured
- **WHEN** `search.engine` is unset and `search.exa.apiKey` is configured
- **THEN** `detectSearchBackend()` returns `"exa"`

#### Scenario: searchWebImpl dispatches to Exa
- **WHEN** the selected backend is `"exa"`
- **THEN** `searchWebImpl()` calls `searchWithExa`

### Requirement: Exa in search tool description

The system SHALL include `"exa"` in the `searchWeb` tool description's list of built-in engines.

#### Scenario: Tool description lists Exa
- **WHEN** the `searchWeb` tool description is inspected
- **THEN** it lists `exa` among the built-in engines

### Requirement: Exa in config.yaml

The system SHALL declare an `exa:` block with `apiKey: ""` under `search:` in `config.yaml`.

#### Scenario: config.yaml lists exa
- **WHEN** the `search:` section of `config.yaml` is inspected
- **THEN** it contains an `exa` block with an `apiKey` field
