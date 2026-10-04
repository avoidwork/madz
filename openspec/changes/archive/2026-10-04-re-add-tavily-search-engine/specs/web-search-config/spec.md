## MODIFIED Requirements

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
