# web-search-config Specification

## Purpose
TBD - created by archiving change explicit-search-engine-config. Update Purpose after archive.
## Requirements
### Requirement: Explicit search engine selector

The system SHALL provide an explicit `engine` field on the search configuration that selects which search engine is used, defaulting to `duckduckgo`.

#### Scenario: Engine defaults to duckduckgo
- **WHEN** no `engine` is specified in the search configuration
- **THEN** the default engine is `duckduckgo`

#### Scenario: Engine is explicitly set
- **WHEN** `search.engine` is set to a supported value such as `google`
- **THEN** `detectSearchBackend()` returns that value

#### Scenario: Engine is set to an unsupported value
- **WHEN** `search.engine` is set to a value not in the supported enum
- **THEN** `detectSearchBackend()` falls back to the inference chain

### Requirement: Engine selector takes precedence over inference

The system SHALL honor `search.engine` before the inference chain (custom > bing > searxng > duckduckgo) when detecting the search backend.

#### Scenario: Explicit engine overrides configured credentials
- **WHEN** `search.engine` is set to `duckduckgo` but `search.bing.apiKey` is also configured
- **THEN** `detectSearchBackend()` returns `duckduckgo`

#### Scenario: Inference chain when engine is unset
- **WHEN** `search.engine` is not set and `search.custom.url` is configured
- **THEN** `detectSearchBackend()` returns `custom`

### Requirement: Google search engine implementation

The system SHALL implement a `searchWithGoogle(query, limit)` function that searches Google and returns results, and SHALL wire a `case "google"` into the `searchWebImpl()` switch.

#### Scenario: Google search returns results
- **WHEN** `searchWithGoogle` is invoked with a query and limit
- **THEN** it returns `{ ok: true, results }` with title, url, and description fields

#### Scenario: Google search fails
- **WHEN** the Google search request fails or returns no results
- **THEN** it returns `{ ok: false, error }`

### Requirement: Explicit config.yaml search values

The system SHALL list every search engine's config values explicitly in `config.yaml`, including DuckDuckGo, Bing, SearXNG, Custom, and a `tavily` block.

#### Scenario: config.yaml lists all engines
- **WHEN** the `search:` section of `config.yaml` is inspected
- **THEN** it contains `engine`, `duckduckgo`, `bing`, `searxng`, `custom`, and `tavily` blocks

#### Scenario: Removed engines are absent
- **WHEN** the `search:` section of `config.yaml` is inspected
- **THEN** it does not contain `exa`, `firecrawl`, or `parallel` blocks

### Requirement: Search config schema lists only implemented engines

The system SHALL declare only implemented engines in `SearchConfigSchema`, and SHALL NOT declare `exa`, `firecrawl`, or `parallel`.

#### Scenario: Schema enum matches implemented engines
- **WHEN** `SearchConfigSchema` is inspected
- **THEN** its `engine` enum contains `duckduckgo`, `bing`, `searxng`, `custom`, and `tavily`

#### Scenario: Removed engines are not in schema
- **WHEN** `SearchConfigSchema` is inspected
- **THEN** it does not contain `exa`, `firecrawl`, or `parallel` sub-schemas

### Requirement: Search tool description reflects supported engines

The system SHALL update the `searchWeb` tool description to reflect the actual supported engines, including Tavily.

#### Scenario: Tool description lists supported engines
- **WHEN** the `searchWeb` tool description is inspected
- **THEN** it lists the implemented engines including Tavily and does not reference unimplemented engines

