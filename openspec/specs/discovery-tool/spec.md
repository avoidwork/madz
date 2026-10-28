# discovery-tool Specification

## Purpose
TBD - created by archiving change discovery-tool. Update Purpose after archive.
## Requirements
### Requirement: Dedicated discovery tool with action key
The system SHALL expose a `discovery` tool that uses an `action` key to select the discovery operation, following the same pattern as the `file` tool. The `action` field SHALL be required and SHALL accept one of `ls`, `glob`, `grep`. The tool SHALL require only `filesystem:read` permission.

#### Scenario: Ls action lists directory contents
- **WHEN** the agent calls `discovery` with `action: "ls"` and a valid `path`
- **THEN** the tool returns the directory entries

#### Scenario: Glob action matches files
- **WHEN** the agent calls `discovery` with `action: "glob"`, a valid `path`, and a `pattern`
- **THEN** the tool returns matching file paths

#### Scenario: Grep action searches file contents
- **WHEN** the agent calls `discovery` with `action: "grep"`, a valid `path`, and a `pattern`
- **THEN** the tool returns matching lines

#### Scenario: Unknown action returns an error
- **WHEN** the agent calls `discovery` with an `action` not in the valid set
- **THEN** the tool returns an error listing the valid actions

### Requirement: Path validation against sandbox allowlist
The system SHALL validate every `path` passed to the `discovery` tool against the sandbox `allowedPaths` via `validatePath` from `src/tools/common.js`. If the path is outside the sandbox scope, the tool SHALL return an access-denied error and SHALL NOT perform any filesystem operation.

#### Scenario: Path outside sandbox is denied
- **WHEN** the agent calls `discovery` with a `path` outside the configured `allowedPaths`
- **THEN** the tool returns an access-denied error and performs no filesystem operation

#### Scenario: Path inside sandbox is allowed
- **WHEN** the agent calls `discovery` with a `path` inside the configured `allowedPaths`
- **THEN** the tool proceeds with the requested operation

### Requirement: Glob exclusions
The system SHALL exclude `node_modules` and `.git` directories from glob results via the `EXCLUDED_DIRS` constant.

#### Scenario: Glob excludes node_modules and .git
- **WHEN** the agent calls `discovery` with `action: "glob"` on a directory containing `node_modules` and `.git`
- **THEN** the tool returns results excluding those directories

### Requirement: Binary safety in native grep fallback
The system SHALL skip binary files in the native grep fallback via null-byte detection.

#### Scenario: Native grep skips binary files
- **WHEN** the native grep fallback encounters a binary file (contains null bytes)
- **THEN** the tool skips that file and continues searching

### Requirement: Read-only permission
The `discovery` tool SHALL require only `filesystem:read` permission and SHALL NOT perform any write operation.

#### Scenario: Discovery tool is registered read-only
- **WHEN** the `discovery` tool is registered in `TOOL_PERMISSIONS`
- **THEN** it maps to `["filesystem:read"]`

