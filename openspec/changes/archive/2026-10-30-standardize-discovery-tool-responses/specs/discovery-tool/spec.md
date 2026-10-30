# Spec Delta

## ADDED Requirements

### Requirement: Structured responses
The `discovery` tool SHALL return structured objects from all actions (`ls`, `glob`, `grep`) and the unknown-action error path. On success the tool SHALL return `{ ok: true, ... }` with the relevant data; on failure the tool SHALL return `{ ok: false, error: ... }` where `error` is a human-readable message. The `ok` boolean SHALL be the discriminator between success and failure.

#### Scenario: Ls action returns structured success
- **WHEN** the agent calls `discovery` with `action: "ls"` and a valid `path`
- **THEN** the tool returns `{ ok: true, entries }` where `entries` is an array of directory entry names

#### Scenario: Ls action returns structured failure
- **WHEN** the agent calls `discovery` with `action: "ls"` and a `path` outside the sandbox allowlist
- **THEN** the tool returns `{ ok: false, error }` and performs no filesystem operation

#### Scenario: Glob action returns structured success
- **WHEN** the agent calls `discovery` with `action: "glob"`, a valid `path`, and a `pattern`
- **THEN** the tool returns `{ ok: true, matches }` where `matches` is an array of matching file paths

#### Scenario: Glob action returns structured empty result
- **WHEN** the agent calls `discovery` with `action: "glob"` and a `pattern` that matches no files
- **THEN** the tool returns `{ ok: true, matches: [] }`

#### Scenario: Grep action returns structured success
- **WHEN** the agent calls `discovery` with `action: "grep"`, a valid `path`, and a `pattern`
- **THEN** the tool returns `{ ok: true, matches, count }` where `matches` is an array of matching lines and `count` is the number of matches

#### Scenario: Grep action returns structured empty result
- **WHEN** the agent calls `discovery` with `action: "grep"` and a `pattern` that matches no lines
- **THEN** the tool returns `{ ok: true, matches: [], count: 0 }`

#### Scenario: Unknown action returns structured error
- **WHEN** the agent calls `discovery` with an `action` not in the valid set
- **THEN** the tool returns `{ ok: false, error }` listing the valid actions
