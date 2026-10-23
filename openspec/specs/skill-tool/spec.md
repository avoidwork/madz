# skill-tool Specification

## Purpose
TBD - created by archiving change skill-tool. Update Purpose after archive.
## Requirements
### Requirement: Skill tool loads SKILL.md body

The system SHALL provide a `skill` tool that takes a skill name and returns the full SKILL.md body for that skill. The body is loaded from the registry's stored body path via `SkillRegistry.getSkillBody(name)`. When the skill is unknown or has no body path, the tool SHALL return a clear error message.

#### Scenario: Skill tool returns the body for a registered skill

- **WHEN** the `skill` tool is called with the name of a registered skill
- **THEN** the tool returns the full SKILL.md body for that skill

#### Scenario: Skill tool errors on an unknown skill

- **WHEN** the `skill` tool is called with a name that is not registered
- **THEN** the tool returns a clear error indicating the skill was not found

#### Scenario: Skill tool errors on a skill with no body path

- **WHEN** the `skill` tool is called with a registered skill that has no stored body path
- **THEN** the tool returns a clear error indicating the body could not be loaded

### Requirement: Skill tool returns supporting-file inventory

The system SHALL return, alongside the body, a sampled inventory of the skill's supporting files (under scripts/, references/, and assets/), excluding SKILL.md. The file list SHALL be capped at approximately 10 entries to avoid context bloat.

#### Scenario: Skill tool lists supporting files

- **WHEN** the `skill` tool is called for a skill that has a scripts/ directory
- **THEN** the tool returns a `files` array containing the supporting-file paths

#### Scenario: Skill tool caps the file list

- **WHEN** a skill has more than 10 supporting files
- **THEN** the tool returns at most 10 entries in the `files` array

### Requirement: Skill tool is universal

The system SHALL make the `skill` tool available to the orchestrator and all subagents. It SHALL be registered in `ORCHESTRATOR_TOOLS`, `TOOL_PERMISSIONS`, `TOOLS`, and `TOOL_CLASSIFICATIONS` for all 12 agent types.

#### Scenario: Skill tool is available to the orchestrator

- **WHEN** the orchestrator is built
- **THEN** the `skill` tool is present in the orchestrator's tool set

#### Scenario: Skill tool is available to every subagent

- **WHEN** subagent definitions are built
- **THEN** the `skill` tool is present in every subagent's tool set via `getToolsForAgentTypes`

### Requirement: Skill tool is read-only

The system SHALL gate the `skill` tool with `filesystem:read` permission only. It SHALL NOT introduce a per-skill permission or approval system.

#### Scenario: Skill tool requires filesystem read

- **WHEN** the `skill` tool is registered
- **THEN** it is gated by `filesystem:read` permission only

### Requirement: Remove skills-directory stopgap message

The system SHALL remove the "Skills are in your skills/ directory." suffix from the two `pendingSilentMessageRef` strings in `src/tui/app.js` (the project-selection and clear-project notifications).

#### Scenario: Project selection omits the stopgap

- **WHEN** a project is selected in the TUI
- **THEN** the silent notification reads `We are working in projects/<name>.` without the skills-directory suffix

#### Scenario: Clear-project omits the stopgap

- **WHEN** the active project is cleared in the TUI
- **THEN** the silent notification reads `We are now working in madz root directory.` without the skills-directory suffix

