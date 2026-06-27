# scan-agents Specification
## Purpose

The scanAgents tool enables agents to discover and load AGENTS.md files from a specified path or the current working directory. It returns file contents when found, an empty string when not found, and uses existing path validation infrastructure for safety. This is the foundational discovery mechanism that enabled the broader subAgent delegation infrastructure..
## Requirements
### Requirement: Tool discovers AGENTS.md in specified path
The scanAgents tool SHALL accept an optional `path` parameter and check for the existence of an `AGENTS.md` file at that location. If no path is provided, the tool SHALL use the current working directory (`process.cwd()`) as the default.

#### Scenario: Scan current working directory
- **WHEN** the tool is called with no arguments
- **THEN** the tool checks for `AGENTS.md` in the current working directory

#### Scenario: Scan specified path
- **WHEN** the tool is called with a `path` parameter
- **THEN** the tool checks for `AGENTS.md` in the specified directory

### Requirement: Tool returns file contents when AGENTS.md is found
The scanAgents tool SHALL read and return the complete contents of the `AGENTS.md` file when it exists at the target path. The content SHALL be returned as a UTF-8 encoded string.

#### Scenario: AGENTS.md exists and is readable
- **WHEN** `AGENTS.md` exists at the target path and is readable
- **THEN** the tool returns the file contents as a string

#### Scenario: AGENTS.md contains special characters
- **WHEN** `AGENTS.md` contains non-ASCII characters
- **THEN** the tool returns the content decoded as UTF-8

### Requirement: Tool completes silently when AGENTS.md is not found
The scanAgents tool SHALL return an empty string when `AGENTS.md` does not exist at the target path. The tool SHALL NOT log errors, throw exceptions, or return error messages in this case.

#### Scenario: AGENTS.md does not exist
- **WHEN** `AGENTS.md` does not exist at the target path
- **THEN** the tool returns an empty string

#### Scenario: Target directory does not exist
- **WHEN** the target path does not exist
- **THEN** the tool returns an empty string

### Requirement: Tool validates paths for safety
The scanAgents tool SHALL use `validatePath` from `src/tools/common.js` to ensure the requested path is within allowed sandbox directories. The tool SHALL reject paths that attempt path traversal or access files outside allowed paths.

#### Scenario: Path is within allowed directories
- **WHEN** the requested path resolves to an allowed directory
- **THEN** the tool proceeds with the scan

#### Scenario: Path attempts traversal outside allowed directories
- **WHEN** the requested path contains `..` sequences that escape allowed directories
- **THEN** the tool returns an error message indicating the path is not allowed

### Requirement: Tool enforces file size limits
The scanAgents tool SHALL use `checkFileLimit` from `src/tools/common.js` to verify that the `AGENTS.md` file does not exceed the configured maximum read size. Files exceeding this limit SHALL be rejected with an error message.

#### Scenario: AGENTS.md is within size limit
- **WHEN** `AGENTS.md` exists and is within the maximum read size
- **THEN** the tool reads and returns the file contents

#### Scenario: AGENTS.md exceeds size limit
- **WHEN** `AGENTS.md` exists but exceeds the maximum read size
- **THEN** the tool returns an error message indicating the file is too large

