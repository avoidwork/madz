# Spec Delta

## Purpose

Defines the `date` tool's response contract so consumers can reliably distinguish success from failure and parse returned data.

## ADDED Requirements

### Requirement: date tool returns structured success response
The `date` tool SHALL return a structured object `{ ok: true, date, format }` on success, where `date` is the formatted date string and `format` echoes the requested format (`"iso"` or `"human"`).

#### Scenario: Default format returns ISO 8601
- **WHEN** the `date` tool is invoked with no `format` option
- **THEN** it returns `{ ok: true, date: <ISO 8601 string>, format: "iso" }`

#### Scenario: Explicit iso format
- **WHEN** the `date` tool is invoked with `format: "iso"`
- **THEN** it returns `{ ok: true, date: <ISO 8601 string>, format: "iso" }`

#### Scenario: Human format
- **WHEN** the `date` tool is invoked with `format: "human"`
- **THEN** it returns `{ ok: true, date: <human-readable string>, format: "human" }`

### Requirement: date tool returns structured failure response
The `date` tool SHALL return a structured object `{ ok: false, error }` when an invalid format is provided, where `error` is a descriptive message.

#### Scenario: Invalid format
- **WHEN** the `date` tool is invoked with an unsupported `format` value
- **THEN** it returns `{ ok: false, error: <descriptive message> }`
