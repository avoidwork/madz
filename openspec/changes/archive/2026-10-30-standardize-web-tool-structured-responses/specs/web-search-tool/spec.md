# Spec Delta

## Purpose

Defines the response contract of the `searchWeb` tool, standardizing its success and failure returns as native structured objects so callers can consume them directly without parsing a serialized string.

## ADDED Requirements

### Requirement: Success returns a native structured object

The `searchWeb` tool SHALL return a native structured object `{ ok: true, backend, query, results }` on a successful search, rather than a `JSON.stringify`-wrapped string.

#### Scenario: Successful search returns a native object

- **WHEN** a search completes successfully
- **THEN** the tool returns an object with `ok` set to `true`, the detected `backend`, the original `query`, and the `results` array

#### Scenario: Success result is not a string

- **WHEN** a search completes successfully
- **THEN** the returned value is a native object and not a serialized JSON string

### Requirement: Failure returns a native structured object

The `searchWeb` tool SHALL return a native structured object `{ ok: false, error }` on failure, rather than a `JSON.stringify`-wrapped string.

#### Scenario: Invalid query returns a native error object

- **WHEN** the query is missing, empty, or not a non-empty string
- **THEN** the tool returns an object with `ok` set to `false` and an `error` message describing the invalid query

#### Scenario: Backend search failure returns a native error object

- **WHEN** the underlying search backend fails
- **THEN** the tool returns an object with `ok` set to `false` and an `error` message describing the failure

#### Scenario: Failure result is not a string

- **WHEN** a search fails
- **THEN** the returned value is a native object and not a serialized JSON string
