# Spec Delta

## Purpose

Provides an `env` tool that reads environment variables from `process.env`, gated by the `env:read` permission scope, with Zod input validation and no secret leakage into logs.

## ADDED Requirements

### Requirement: Env tool reads a single environment variable
The `env` tool SHALL read a single environment variable from `process.env` when given a `name` input, returning its value in a structured result.

#### Scenario: Env tool returns the value of a named variable
- **WHEN** `env` is called with `{ name: "HOME" }`
- **THEN** the tool returns `{ ok: true, name: "HOME", value: <the value of process.env.HOME> }`

#### Scenario: Env tool returns ok:false for a missing variable
- **WHEN** `env` is called with `{ name: "NONEXISTENT_VAR_XYZ" }`
- **THEN** the tool returns `{ ok: false, error: <message> }` indicating the variable is not set

### Requirement: Env tool reads all environment variables
The `env` tool SHALL return the full `process.env` object when called with `{ all: true }`.

#### Scenario: Env tool returns the full environment
- **WHEN** `env` is called with `{ all: true }`
- **THEN** the tool returns `{ ok: true, env: <the full process.env object> }`

### Requirement: Env tool validates input against a Zod schema
The `env` tool SHALL validate its input against a Zod schema before reading any environment variables.

#### Scenario: Env tool rejects invalid input
- **WHEN** `env` is called with an input that fails Zod validation (e.g., a non-string `name`)
- **THEN** the tool returns `{ ok: false, error: <validation message> }`

### Requirement: Env tool requires the env:read permission scope
The `env` tool SHALL register in the tools array only when the `env:read` permission scope is enabled.

#### Scenario: Env tool registers with env:read enabled
- **WHEN** the tool builder runs with `env:read` in the enabled permissions set
- **THEN** the `env` tool is included in the tools array

#### Scenario: Env tool does not register without env:read
- **WHEN** the tool builder runs without `env:read` in the enabled permissions set
- **THEN** the `env` tool is NOT included in the tools array

### Requirement: Env tool does not leak env values into logs
The `env` tool SHALL NOT log raw environment variable values; values are returned only in the structured result.

#### Scenario: Env tool returns values without logging them
- **WHEN** `env` is called with `{ name: "SECRET" }` where `process.env.SECRET` is set
- **THEN** the tool returns the value in the structured result and does not emit the value to any log output
