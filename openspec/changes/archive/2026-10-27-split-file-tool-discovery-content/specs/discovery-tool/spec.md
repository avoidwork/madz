## ADDED Requirements

### Requirement: Discovery tool with ls and glob actions
The system SHALL expose a `discovery` tool that uses an `action` key to select the operation, following the same pattern as the `file`, `todo`, and `memory` tools. The `action` field SHALL be required and SHALL accept one of `ls`, `glob`. The tool SHALL be gated by the `filesystem:read` permission only — it SHALL NOT perform content read or write.

#### Scenario: Ls action lists directory contents
- **WHEN** the agent calls `discovery` with `action: "ls"` and a valid `path`
- **THEN** the tool returns the directory entries

#### Scenario: Glob action matches files
- **WHEN** the agent calls `discovery` with `action: "glob"`, a valid `path`, and a `pattern`
- **THEN** the tool returns matching file paths

#### Scenario: Unknown action returns an error
- **WHEN** the agent calls `discovery` with an `action` not in the valid set
- **THEN** the tool returns an error listing the valid actions

### Requirement: Path validation against sandbox allowlist
The system SHALL validate every `path` passed to the `discovery` tool against the sandbox `allowedPaths` via `validatePath` from `src/tools/common.js`. If the path is outside the sandbox scope, the tool SHALL return an access-denied error and SHALL NOT perform any file operation.

#### Scenario: Path outside sandbox is denied
- **WHEN** the agent calls `discovery` with a `path` outside the configured `allowedPaths`
- **THEN** the tool returns an access-denied error and performs no file operation

#### Scenario: Path inside sandbox is allowed
- **WHEN** the agent calls `discovery` with a `path` inside the configured `allowedPaths`
- **THEN** the tool proceeds with the requested operation

### Requirement: Discovery tool does not read content
The system SHALL NOT grant the `discovery` tool any content-read or content-write capability. The `discovery` tool SHALL be registered with the `filesystem:read` permission only, and SHALL NOT expose `read`, `write`, `edit`, `delete`, or `grep` actions.

#### Scenario: Discovery tool has no content actions
- **WHEN** the agent inspects the `discovery` tool's valid actions
- **THEN** the valid actions SHALL be only `ls` and `glob`
