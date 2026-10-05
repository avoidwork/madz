## ADDED Requirements

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
