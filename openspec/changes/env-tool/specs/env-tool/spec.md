# Spec Delta

## Purpose

Provides an `env` tool that reads environment variables from `process.env`, gated by the `env:read` permission scope, so agents can inspect environment variables without shelling out through `process`.

## ADDED Requirements

### Requirement: env tool reads environment variables
The system SHALL provide an `env` tool that reads environment variables from `process.env` and returns a structured `{ ok: true, data }` result containing the requested variable values.

#### Scenario: Read a known environment variable
- **WHEN** the `env` tool is invoked with the name of a variable that is set in `process.env`
- **THEN** the tool returns `{ ok: true, data }` where `data` contains the variable's value

#### Scenario: Read a missing environment variable
- **WHEN** the `env` tool is invoked with the name of a variable that is not set in `process.env`
- **THEN** the tool returns `{ ok: true, data }` where `data` indicates the variable is unset

### Requirement: env tool input validation
The system SHALL validate all input to the `env` tool against a Zod schema before reading any environment variables, and SHALL return a structured `{ ok: false, error }` result for invalid input.

#### Scenario: Reject empty variable name
- **WHEN** the `env` tool is invoked with an empty variable name
- **THEN** the tool returns `{ ok: false, error }` describing the validation failure

#### Scenario: Reject invalid input shape
- **WHEN** the `env` tool is invoked with input that does not match the Zod schema
- **THEN** the tool returns `{ ok: false, error }` describing the validation failure

### Requirement: env tool permission gating
The system SHALL register the `env` tool only when the `env:read` permission scope is enabled, and SHALL require exactly the `env:read` permission.

#### Scenario: Tool registers with env:read enabled
- **WHEN** `buildToolConfig` is invoked with `env:read` in the enabled permission set
- **THEN** the `env` tool is included in the returned tool array

#### Scenario: Tool does not register without env:read
- **WHEN** `buildToolConfig` is invoked without `env:read` in the enabled permission set
- **THEN** the `env` tool is not included in the returned tool array

### Requirement: env tool does not leak values into logs
The system SHALL not log environment variable values when the `env` tool is invoked, per AGENTS.md 1.2.

#### Scenario: No values logged on invocation
- **WHEN** the `env` tool is invoked to read environment variables
- **THEN** the tool does not emit log output containing the variable values
