# skill-agent-mapping Specification

## Purpose
TBD - created by archiving change add-skill-agent-configurable-mapping. Update Purpose after archive.
## Requirements
### Requirement: Configurable skill-to-agent mapping via config.yaml

The system SHALL support a `skillAgentMap` section in `config.yaml` that maps skill name patterns to agent types using regex matching.

#### Scenario: Pattern matching routes skill to correct agent
- **WHEN** a skill named `openspec-apply-change` is discovered and has no `metadata.agent` in frontmatter
- **THEN** the system checks `skillAgentMap` patterns in order and assigns `metadata.agent` to `coding` if the first matching pattern is `^openspec-`

#### Scenario: First match wins
- **WHEN** multiple patterns in `skillAgentMap` match a skill name
- **THEN** the system uses the first matching pattern and ignores subsequent matches

#### Scenario: Catch-all pattern ensures no orphaned skills
- **WHEN** a skill has no `metadata.agent` and no specific pattern matches
- **THEN** a catch-all pattern (`.*`) assigns the skill to a default agent (e.g., `general-purpose`)

### Requirement: Frontmatter metadata.agent takes priority over config

The system SHALL check a skill's frontmatter `metadata.agent` before falling back to `skillAgentMap` config patterns.

#### Scenario: Frontmatter overrides config
- **WHEN** a skill has `metadata.agent: research` in its frontmatter
- **THEN** the system uses `research` regardless of any matching `skillAgentMap` pattern

#### Scenario: Missing frontmatter falls back to config
- **WHEN** a skill has no `metadata.agent` in its frontmatter
- **THEN** the system falls back to `skillAgentMap` patterns

### Requirement: Agent injection during skill discovery

The system SHALL inject `metadata.agent` into discovered skills before they are added to the registry.

#### Scenario: Agent is injected before registry push
- **WHEN** the discoverer finishes parsing a skill's frontmatter
- **THEN** the skill's metadata includes `agent` either from frontmatter or from `skillAgentMap` config

#### Scenario: Injection is transparent to downstream code
- **WHEN** the registry receives a skill with injected `metadata.agent`
- **THEN** the registry does not need to know about the fallback mechanism

### Requirement: Config validation for skillAgentMap

The system SHALL validate the `skillAgentMap` config section using Zod schema.

#### Scenario: Invalid pattern is rejected
- **WHEN** a `skillAgentMap` entry has an invalid regex pattern
- **THEN** config loading fails with a validation error

#### Scenario: Missing required fields is rejected
- **WHEN** a `skillAgentMap` entry is missing `pattern` or `agent`
- **THEN** config loading fails with a validation error

#### Scenario: Empty skillAgentMap is valid
- **WHEN** `skillAgentMap` is not present in config or is an empty array
- **THEN** config loading succeeds and no fallback mapping is applied

