## Why

The assistant currently has no built-in way to retrieve the current date and time. Without a date tool, it cannot answer time-sensitive questions, produce timestamped outputs, or accurately reason about durations, deadlines, or relative dates.

## What Changes

- Add a `date` tool that returns the current date and time in an ISO 8601 format by default, with a configurable `format` option to switch between ISO 8601 and human-readable output.
- Support a `timezone` option (default: system/local) for timezone awareness.
- Register the tool in the tools index with zero required permissions (like `clarify`).
- Internal representation is always ISO 8601 (parseable); human-readable is a formatting layer on top.

## Capabilities

### New Capabilities
- `date-tool`: Adds a `date` tool that returns the current timestamp in ISO 8601 by default, with optional human-readable formatting and timezone control.

### Modified Capabilities
- None

## Impact

- `src/tools/index.js` — register `date` in `TOOL_PERMISSIONS`, `TOOL_FACTORIES`, and `buildToolConfig`
- `src/tools/date.js` — new file: tool implementation with formatter and factory
- `tests/unit/tools_date.test.js` — new test file
