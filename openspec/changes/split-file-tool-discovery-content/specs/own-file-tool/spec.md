## MODIFIED Requirements

### Requirement: Single file tool with action key
The system SHALL expose a single `file` tool that uses an `action` key to select the operation, following the same pattern as the `todo` and `memory` tools. The `action` field SHALL be required and SHALL accept one of `read`, `write`, `edit`, `delete`.

#### Scenario: Read action returns file content
- **WHEN** the agent calls `file` with `action: "read"` and a valid `path`
- **THEN** the tool returns the file content, with line numbers in `LINE_NUM|CONTENT` format

#### Scenario: Write action creates a file
- **WHEN** the agent calls `file` with `action: "write"`, a valid `path`, and `content`
- **THEN** the tool writes the content to the file and returns a write confirmation

#### Scenario: Edit action applies a string replacement
- **WHEN** the agent calls `file` with `action: "edit"`, a valid `path`, `oldString`, and `newString`
- **THEN** the tool replaces the matching text and returns a confirmation with a unified diff

#### Scenario: Delete action removes a file
- **WHEN** the agent calls `file` with `action: "delete"` and a valid `path`
- **THEN** the tool removes the file and returns a confirmation

#### Scenario: Unknown action returns an error
- **WHEN** the agent calls `file` with an `action` not in the valid set
- **THEN** the tool returns an error listing the valid actions

## REMOVED Requirements

### Requirement: Search action finds matches
**Reason**: The `search` action was redundant with the standalone `grep` tool and the `grep` action. It is removed as part of splitting the `file` tool along the access boundary.
**Migration**: Use the standalone `grep` tool for regex content search.

### Requirement: Ls action lists directory contents
**Reason**: The `ls` action is moved to the new `discovery` tool, which is gated by `filesystem:read` only (path listing without content access).
**Migration**: Use the `discovery` tool with `action: "ls"`.

### Requirement: Glob action matches files
**Reason**: The `glob` action is moved to the new `discovery` tool, which is gated by `filesystem:read` only (path listing without content access).
**Migration**: Use the `discovery` tool with `action: "glob"`.

### Requirement: Grep action searches file contents
**Reason**: The `grep` action is removed; the standalone `grep` tool is the single content-search path.
**Migration**: Use the standalone `grep` tool.
