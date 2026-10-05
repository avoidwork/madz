## MODIFIED Requirements

### Requirement: Explicit config.yaml search values

The system SHALL list every search engine's config values explicitly in `config.yaml`, including DuckDuckGo, Bing, SearXNG, Custom, Tavily, Exa, and Firecrawl.

#### Scenario: config.yaml lists all engines
- **WHEN** the `search:` section of `config.yaml` is inspected
- **THEN** it contains `duckduckgo`, `bing`, `searxng`, `custom`, `tavily`, `exa`, and `firecrawl` blocks

#### Scenario: Removed engines are absent
- **WHEN** the `search:` section of `config.yaml` is inspected
- **THEN** it does not contain a `parallel` block

### Requirement: Search config schema lists only implemented engines

The system SHALL declare only implemented engines in `SearchConfigSchema`, and SHALL NOT declare `parallel`.

#### Scenario: Schema matches implemented engines
- **WHEN** `SearchConfigSchema` is inspected
- **THEN** it contains `duckduckgo`, `bing`, `searxng`, `custom`, `tavily`, `exa`, and `firecrawl` sub-schemas

#### Scenario: Removed engines are not in schema
- **WHEN** `SearchConfigSchema` is inspected
- **THEN** it does not contain a `parallel` sub-schema

### Requirement: Search tool description reflects supported engines

The system SHALL update the `searchWeb` tool description to reflect the actual supported engines, including Tavily, Exa, and Firecrawl.

#### Scenario: Tool description lists supported engines
- **WHEN** the `searchWeb` tool description is inspected
- **THEN** it lists the implemented engines including Tavily, Exa, and Firecrawl and does not reference unimplemented engines
