# Spec Delta

## ADDED Requirements

### Requirement: Structured responses from file tool impls
The system SHALL return structured objects from all `file` tool impl functions (`readImpl`, `writeImpl`, `editImpl`, `deleteImpl`, `fileImpl`) instead of bare strings. On success each impl SHALL return `{ ok: true, ... }` with the relevant data; on failure each impl SHALL return `{ ok: false, error: ... }`.

#### Scenario: Read action returns structured success
- **WHEN** the agent calls `file` with `action: "read"` and a valid `path`
- **THEN** the tool returns `{ ok: true, content, lines }` where `content` is the raw file content and `lines` is the array of `LINE_NUM|CONTENT` strings

#### Scenario: Read action returns structured error
- **WHEN** the agent calls `file` with `action: "read"` on a missing file or an invalid path
- **THEN** the tool returns `{ ok: false, error }` with a descriptive error message

#### Scenario: Write action returns structured success
- **WHEN** the agent calls `file` with `action: "write"`, a valid `path`, and `content`
- **THEN** the tool writes the content and returns `{ ok: true, path, bytesWritten }`

#### Scenario: Write action returns structured error
- **WHEN** the agent calls `file` with `action: "write"` on a path outside the sandbox or with content exceeding the max size
- **THEN** the tool returns `{ ok: false, error }` with a descriptive error message

#### Scenario: Edit action returns structured success
- **WHEN** the agent calls `file` with `action: "edit"`, a valid `path`, `oldString`, and `newString` that matches
- **THEN** the tool applies the replacement and returns `{ ok: true, changes, diff }`

#### Scenario: Edit action returns structured error
- **WHEN** the agent calls `file` with `action: "edit"` and an `oldString` that does not match the file content
- **THEN** the tool returns `{ ok: false, error, suggestions? }` with a descriptive error message and optional suggestions

#### Scenario: Delete action returns structured success
- **WHEN** the agent calls `file` with `action: "delete"` and a valid `path`
- **THEN** the tool removes the file and returns `{ ok: true, path }`

#### Scenario: Delete action returns structured error
- **WHEN** the agent calls `file` with `action: "delete"` on a missing file or an invalid path
- **THEN** the tool returns `{ ok: false, error }` with a descriptive error message

#### Scenario: Unknown action returns structured error
- **WHEN** the agent calls `file` with an `action` not in the valid set
- **THEN** the tool returns `{ ok: false, error }` listing the valid actions
