## Purpose

Extend skill discovery to inject `metadata.agent` from config patterns when not present in frontmatter, ensuring openspec-* and other external skills are properly routed to sub-agents.

## Purpose

Extend skill discovery to inject `metadata.agent` from config patterns when not present in frontmatter, ensuring openspec-* and other external skills are properly routed to sub-agents.

## MODIFIED Requirements

### Requirement: SKILL.md Frontmatter Discovery
The system SHALL automatically discover all skills by scanning for subdirectories containing a `SKILL.md` file. Metadata is extracted from the YAML frontmatter between `---` delimiters at the top of the file. Required frontmatter fields: `name` (mandatory) and `description` (mandatory). Optional fields: `license`, `compatibility` (max 500 chars), `metadata` (string-to-string map), `allowed-tools`, `disabled`. If `metadata.agent` is not present in the frontmatter, the system SHALL check the `skillAgentMap` config section for a matching pattern and inject the matched agent into `metadata.agent` before the skill is registered.

#### Scenario: System discovers a SKILL.md with valid frontmatter
- **WHEN** a subdirectory of the skills scan path contains a `SKILL.md` with valid YAML frontmatter containing name and description
- **THEN** the registry registers the skill with the extracted metadata and makes it available for activation

#### Scenario: System discovers a SKILL.md without description
- **WHEN** a `SKILL.md` exists but its frontmatter lacks a non-empty description field
- **THEN** the system skips the skill and logs a warning

#### Scenario: System discovers a SKILL.md without YAML frontmatter
- **WHEN** a `SKILL.md` exists but has no YAML frontmatter between `---` delimiters
- **THEN** the system skips the skill and logs a warning

#### Scenario: Skill without metadata.agent falls back to config
- **WHEN** a `SKILL.md` has valid frontmatter but no `metadata.agent` field
- **THEN** the system checks `skillAgentMap` config patterns and injects the matched agent into `metadata.agent`

#### Scenario: Skill with metadata.agent is not overridden by config
- **WHEN** a `SKILL.md` has `metadata.agent: research` in its frontmatter
- **THEN** the system uses the frontmatter value and does not check `skillAgentMap` config