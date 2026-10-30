# Spec Delta

## MODIFIED Requirements

### Requirement: Tool returns file contents when AGENTS.md is found
The scanAgents tool SHALL read and return the complete contents of the `AGENTS.md` file when it exists at the target path. The tool SHALL return a structured object `{ ok: true, agents: <content> }` where `<content>` is the complete file contents as a UTF-8 encoded string.

#### Scenario: AGENTS.md exists and is readable
- **WHEN** `AGENTS.md` exists at the target path and is readable
- **THEN** the tool returns `{ ok: true, agents: <content> }`

#### Scenario: AGENTS.md contains special characters
- **WHEN** `AGENTS.md` contains non-ASCII characters
- **THEN** the tool returns `{ ok: true, agents: <content> }` with the content decoded as UTF-8

### Requirement: Tool completes silently when AGENTS.md is not found
The scanAgents tool SHALL return `{ ok: true, agents: "" }` when `AGENTS.md` does not exist at the target path. The tool SHALL NOT log errors, throw exceptions, or return an error object in this case.

#### Scenario: AGENTS.md does not exist
- **WHEN** `AGENTS.md` does not exist at the target path
- **THEN** the tool returns `{ ok: true, agents: "" }`

#### Scenario: Target directory does not exist
- **WHEN** the target path does not exist
- **THEN** the tool returns `{ ok: true, agents: "" }`

### Requirement: Tool validates paths for safety
The scanAgents tool SHALL use `validatePath` from `src/tools/common.js` to ensure the requested path is within allowed sandbox directories. The tool SHALL reject paths that attempt path traversal or access files outside allowed paths by returning `{ ok: false, error: <message> }`.

#### Scenario: Path is within allowed directories
- **WHEN** the requested path resolves to an allowed directory
- **THEN** the tool proceeds with the scan

#### Scenario: Path attempts traversal outside allowed directories
- **WHEN** the requested path contains `..` sequences that escape allowed directories
- **THEN** the tool returns `{ ok: false, error: <message> }` indicating the path is not allowed

### Requirement: Tool enforces file size limits
The scanAgents tool SHALL use `checkFileLimit` from `src/tools/common.js` to verify that the `AGENTS.md` file does not exceed the configured maximum read size. Files exceeding this limit SHALL be rejected with `{ ok: false, error: <message> }`.

#### Scenario: AGENTS.md is within size limit
- **WHEN** `AGENTS.md` exists and is within the maximum read size
- **THEN** the tool reads and returns `{ ok: true, agents: <content> }`

#### Scenario: AGENTS.md exceeds size limit
- **WHEN** `AGENTS.md` exists but exceeds the maximum read size
- **THEN** the tool returns `{ ok: false, error: <message> }` indicating the file is too large
