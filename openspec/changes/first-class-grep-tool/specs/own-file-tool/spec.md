## MODIFIED Requirements

### Requirement: Single file tool with action key
The system SHALL expose a single `file` tool that uses an `action` key to select the operation, following the same pattern as the `todo` and `memory` tools. The `action` field SHALL be required and SHALL accept one of `read`, `write`, `edit`, `delete`, `ls`, `glob`, `grep`. The `search` action SHALL be removed; `grep` is the single grep entry point.

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

#### Scenario: Ls action lists directory contents
- **WHEN** the agent calls `file` with `action: "ls"` and a valid `path`
- **THEN** the tool returns the directory entries

#### Scenario: Glob action matches files
- **WHEN** the agent calls `file` with `action: "glob"`, a valid `path`, and a `glob` pattern
- **THEN** the tool returns matching file paths

#### Scenario: Grep action searches file contents
- **WHEN** the agent calls `file` with `action: "grep"`, a valid `path`, and a `pattern`
- **THEN** the tool returns matching lines

#### Scenario: Search action is no longer valid
- **WHEN** the agent calls `file` with `action: "search"`
- **THEN** the tool returns an error listing the valid actions, and no search is performed

#### Scenario: Unknown action returns an error
- **WHEN** the agent calls `file` with an `action` not in the valid set
- **THEN** the tool returns an error listing the valid actions
