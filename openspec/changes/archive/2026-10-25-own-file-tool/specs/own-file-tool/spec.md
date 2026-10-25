## ADDED Requirements

### Requirement: Single file tool with action key
The system SHALL expose a single `file` tool that uses an `action` key to select the operation, following the same pattern as the `todo` and `memory` tools. The `action` field SHALL be required and SHALL accept one of `read`, `write`, `edit`, `delete`, `search`, `ls`, `glob`, `grep`.

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

#### Scenario: Search action finds matches
- **WHEN** the agent calls `file` with `action: "search"`, a valid `path`, and a `pattern`
- **THEN** the tool returns matching lines with file paths and line numbers

#### Scenario: Ls action lists directory contents
- **WHEN** the agent calls `file` with `action: "ls"` and a valid `path`
- **THEN** the tool returns the directory entries

#### Scenario: Glob action matches files
- **WHEN** the agent calls `file` with `action: "glob"`, a valid `path`, and a `glob` pattern
- **THEN** the tool returns matching file paths

#### Scenario: Grep action searches file contents
- **WHEN** the agent calls `file` with `action: "grep"`, a valid `path`, and a `pattern`
- **THEN** the tool returns matching lines

#### Scenario: Unknown action returns an error
- **WHEN** the agent calls `file` with an `action` not in the valid set
- **THEN** the tool returns an error listing the valid actions

### Requirement: Path validation against sandbox allowlist
The system SHALL validate every `path` passed to the `file` tool against the sandbox `allowedPaths` via `validatePath` from `src/tools/common.js`. If the path is outside the sandbox scope, the tool SHALL return an access-denied error and SHALL NOT perform any file operation.

#### Scenario: Path outside sandbox is denied
- **WHEN** the agent calls `file` with a `path` outside the configured `allowedPaths`
- **THEN** the tool returns an access-denied error and performs no file operation

#### Scenario: Path inside sandbox is allowed
- **WHEN** the agent calls `file` with a `path` inside the configured `allowedPaths`
- **THEN** the tool proceeds with the requested operation

### Requirement: Size limit enforcement
The system SHALL enforce the configured max read size via `checkFileLimit` from `src/tools/common.js` for read operations. If the file exceeds the limit, the tool SHALL return an error suggesting pagination via `limit`/`offset`.

#### Scenario: File exceeds max read size
- **WHEN** the agent calls `file` with `action: "read"` on a file larger than the configured max read size
- **THEN** the tool returns an error indicating the file exceeds the max read size and suggests using `limit`/`offset`

#### Scenario: File within max read size is read
- **WHEN** the agent calls `file` with `action: "read"` on a file within the configured max read size
- **THEN** the tool returns the file content

### Requirement: Edit action applies unified diff or string replacement
The system SHALL implement the `edit` action to apply either a unified-diff patch (reusing `generateUnifiedDiff`) or a string replacement via `oldString`/`newString`. The edit SHALL use fuzzy matching so it is resilient to whitespace and case drift.

#### Scenario: Edit with no match returns an error
- **WHEN** the agent calls `file` with `action: "edit"` and an `oldString` that does not match the file content
- **THEN** the tool returns an error indicating the text was not found, with suggestions

#### Scenario: Edit with a match applies the replacement
- **WHEN** the agent calls `file` with `action: "edit"` and an `oldString` that matches the file content
- **THEN** the tool applies the replacement and returns a confirmation with a unified diff

### Requirement: No execute action
The system SHALL NOT include an `execute` action in the `file` tool. Shell command execution SHALL remain exclusively in the `process` tool.

#### Scenario: Execute is not a valid action
- **WHEN** the agent calls `file` with `action: "execute"`
- **THEN** the tool returns an error listing the valid actions, and no shell command is executed
