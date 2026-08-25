## Why

The orchestrator agent needs access to the `cronJob` tool to manage scheduled jobs during active sessions. Currently, `cronJob` is classified only for `security-audit` and `performance` agent types, and it is not included in the `ORCHESTRATOR_TOOLS` array. This means the orchestrator cannot create, list, pause, resume, or remove cron jobs — a gap that prevents self-service scheduling during interactive sessions.

## What Changes

- Add `"cronJob"` to the `ORCHESTRATOR_TOOLS` array in `src/tools/index.js`
- Add `"orchestrator"` to the `cronJob` classification in `TOOL_CLASSIFICATIONS` in `src/tools/index.js`
- Update the README.md Built-in Tools table to document that the orchestrator has access to `cronJob`
- Add unit tests verifying the orchestrator has access to `cronJob`

## Capabilities

### Modified Capabilities

- `orchestrator-tools`: Extended to include `cronJob` tool access
- `tool-classifications`: Extended `cronJob` to include `orchestrator` agent type

## Impact

- **Affected code**: `src/tools/index.js`, `README.md`, `tests/unit/` (new test file)
- **Dependencies**: None — `cronJob` tool already exists and is fully implemented
- **Tests**: New test file `tests/unit/tools_orchestrator.test.js`

## Non-goals

- Adding cronJob access to other agent types beyond orchestrator
- Modifying cronJob tool implementation or permissions
- Adding new cronJob actions or capabilities
