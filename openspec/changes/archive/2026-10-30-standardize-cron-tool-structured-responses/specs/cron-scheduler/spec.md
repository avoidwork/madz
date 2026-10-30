# Spec Delta

## ADDED Requirements

### Requirement: Cron tool returns native structured objects
The cron tool's `cronJobImpl` SHALL return native structured objects instead of `JSON.stringify`-wrapped strings. On success, it SHALL return `{ ok: true, ...result }`; on failure, it SHALL return `{ ok: false, error }`. The `run` action SHALL pass through the nested `{ ok, ... }` result from `runJob` as a native object.

#### Scenario: Successful create returns native object
- **WHEN** the user creates a job with valid `name`, `cron`, and `skill`
- **THEN** the tool returns a native object (not a string) with `ok: true`
- **THEN** the returned object contains the persisted `job` with its `name`, `cron`, `skill`, and `enabled` fields

#### Scenario: Failed create returns native error object
- **WHEN** the user creates a job with a missing required field
- **THEN** the tool returns a native object (not a string) with `ok: false`
- **THEN** the returned object contains an `error` string describing the missing field

#### Scenario: List returns native object with jobs array
- **WHEN** the user lists jobs
- **THEN** the tool returns a native object (not a string) with `ok: true`
- **THEN** the returned object contains a `jobs` array

#### Scenario: Unknown action returns native error object
- **WHEN** the user passes an unknown action
- **THEN** the tool returns a native object (not a string) with `ok: false`
- **THEN** the returned object contains an `error` string listing valid actions

#### Scenario: Run passes through nested result as native object
- **WHEN** the user runs a job
- **THEN** the tool returns the nested `{ ok, ... }` result from `runJob` as a native object (not a string)
