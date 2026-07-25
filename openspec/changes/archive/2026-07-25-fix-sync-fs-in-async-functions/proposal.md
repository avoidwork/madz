## Why

The codebase contains synchronous file system calls (`existsSync()`) inside async functions, which block the Node.js event loop and can cause performance degradation under load. Additionally, a silent catch block in the TUI streaming callback makes troubleshooting difficult when errors occur.

## What Changes

- Replace `existsSync()` with `fs.promises.access()` in `src/scheduler/scheduler.js` async `runNow()` function
- Replace `existsSync()` with `fs.promises.access()` in `src/tools/cron.js` async `findSkillScript()` function
- Add debug-level logging to the streaming callback catch block in `src/tui/app.js` line 779

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- None (implementation detail only, no spec-level behavior changes)

## Impact

- `src/scheduler/scheduler.js` - async function modification
- `src/tools/cron.js` - async function modification
- `src/tui/app.js` - error handling enhancement

## Non-goals

- This does not address `readFileSync()` usage in synchronous utility functions (acceptable per AGENTS.md §1.1)
- This does not change the silent behavior of the catch block, only adds observability
