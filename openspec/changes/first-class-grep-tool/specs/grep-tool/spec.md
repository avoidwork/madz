## ADDED Requirements

### Requirement: First-class grep tool
The system SHALL expose a dedicated `grep` tool that performs literal regex search across files. The tool SHALL accept a `pattern` (required), an optional `path`, and an optional `maxResults`. It SHALL reuse the existing ripgrep/native-fs search logic and SHALL validate every `path` against the sandbox `allowedPaths` via `validatePath`.

#### Scenario: Grep finds matches
- **WHEN** the agent calls `grep` with a `pattern` and a valid `path`
- **THEN** the tool returns matching lines with file paths and line numbers

#### Scenario: Grep with no matches
- **WHEN** the agent calls `grep` with a `pattern` that matches nothing
- **THEN** the tool returns "No matches found."

#### Scenario: Grep requires a pattern
- **WHEN** the agent calls `grep` without a `pattern`
- **THEN** the tool's schema validation fails

#### Scenario: Grep validates path against sandbox
- **WHEN** the agent calls `grep` with a `path` outside the configured `allowedPaths`
- **THEN** the tool returns an access-denied error and performs no search

#### Scenario: Grep caps results
- **WHEN** the agent calls `grep` with a `maxResults` value
- **THEN** the tool returns at most that many matches

#### Scenario: Grep falls back to native search
- **WHEN** ripgrep (`rg`) is unavailable
- **THEN** the tool falls back to the native fs walk search
