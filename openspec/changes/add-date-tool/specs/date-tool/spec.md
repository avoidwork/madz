## ADDED Requirements

### Requirement: Date Tool Returns ISO 8601 by Default
The `date` tool SHALL return the current date and time as an ISO 8601 UTC string by default (e.g., `2026-06-03T14:30:00.000Z`). The tool takes no input parameters and requires zero permissions.

#### Scenario: Date tool returns ISO 8601 UTC string by default
- **WHEN** `date` is called with empty input or `format: "iso"`
- **THEN** the tool returns a string matching the ISO 8601 format (e.g., `2026-06-03T14:30:00.000Z`)

#### Scenario: Date tool accepts format option
- **WHEN** `date` is called with `format: "iso"`
- **THEN** the tool returns an ISO 8601 UTC string

#### Scenario: Date tool accepts human format option
- **WHEN** `date` is called with `format: "human"`
- **THEN** the tool returns a human-readable string via `Date.prototype.toString()` (e.g., `Wed Jun 03 2026 10:30:00 GMT-0400 (EDT)`)

### Requirement: Date Tool Returns Current Time (Not Cached)
The `date` tool SHALL reflect the actual current time, not a cached or stale value.

#### Scenario: Date tool returns current time
- **WHEN** `date` is called twice with at least 1 second between invocations
- **THEN** each call returns a distinct timestamp reflecting the actual current time

### Requirement: Date Tool Registers Without Permissions
The `date` tool SHALL be registered in the tools array even when no sandbox permissions are enabled.

#### Scenario: Date tool registers without permissions
- **WHEN** the tool builder runs with no sandbox permissions enabled
- **THEN** the `date` tool is included in the tools array
