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

The system SHALL list every search engine's config values explicitly in `config.yaml`, including DuckDuckGo, Bing, SearXNG, Custom, Tavily, and a `firecrawl` block.

#### Scenario: config.yaml lists all engines
- **WHEN** the `search:` section of `config.yaml` is inspected
- **THEN** it contains `duckduckgo`, `bing`, `searxng`, `custom`, `tavily`, and `firecrawl` blocks

#### Scenario: Removed engines are absent
- **WHEN** the `search:` section of `config.yaml` is inspected
- **THEN** it does not contain `exa` or `parallel` blocks

### Requirement: Search config schema lists only implemented engines

The system SHALL declare only implemented engines in `SearchConfigSchema`, and SHALL NOT declare `exa` or `parallel`.

#### Scenario: Schema matches implemented engines
- **WHEN** `SearchConfigSchema` is inspected
- **THEN** it contains `duckduckgo`, `bing`, `searxng`, `custom`, `tavily`, and `firecrawl` sub-schemas

#### Scenario: Removed engines are not in schema
- **WHEN** `SearchConfigSchema` is inspected
- **THEN** it does not contain `exa` or `parallel` sub-schemas

### Requirement: Search tool description reflects supported engines

The system SHALL update the `searchWeb` tool description to reflect the actual supported engines, including Tavily and Firecrawl.

#### Scenario: Tool description lists supported engines
- **WHEN** the `searchWeb` tool description is inspected
- **THEN** it lists the implemented engines including Tavily and Firecrawl and does not reference unimplemented engines

### Requirement: Brave in search config schema

The system SHALL declare `brave` in `SearchConfigSchema` with a `BraveSearchSchema` (`apiKey` field).

#### Scenario: Brave sub-schema is declared
- **WHEN** `SearchConfigSchema` is inspected
- **THEN** it contains a `brave` sub-schema with an `apiKey` field

### Requirement: Brave in config.yaml

The system SHALL list a `brave` block with an `apiKey` field under the `search:` section of `config.yaml`.

#### Scenario: config.yaml lists brave
- **WHEN** the `search:` section of `config.yaml` is inspected
- **THEN** it contains a `brave` block with an `apiKey` field

### Requirement: Search tool description reflects brave

The system SHALL update the `searchWeb` tool description to list Brave as a supported engine.

#### Scenario: Tool description lists brave
- **WHEN** the `searchWeb` tool description is inspected
- **THEN** it lists Brave among the implemented engines

