## Why

The subAgent tool contains two pieces of dead code that create confusion and technical debt: the `MADZ_SUBAGENT_TIMEOUT` environment variable check (which bypasses the centralized config system) and the `MADZ_SESSION_ID` environment variable (which is passed to child processes but never consumed). These were introduced as configuration paths that no longer serve a purpose, creating a third configuration tier that contradicts the intended priority chain and adding noise to the process environment.

## What Changes

- Remove `MADZ_SUBAGENT_TIMEOUT` env var check from `resolveTimeout()` in `src/tools/subAgent.js` — fall through directly from per-call timeout to config.yaml default
- Remove `MADZ_SESSION_ID` from child process environment in `src/tools/subAgent.js` — it's never read by parent or child
- Update tool description to remove "Overrides MADZ_SUBAGENT_TIMEOUT env var" reference
- Remove tests that validate env var priority behavior in `tests/unit/tools/subAgent.test.js`
- No new capabilities or API changes — this is a cleanup of dead code only

## Capabilities

### New Capabilities
<!-- None — this is a cleanup task, no new capabilities -->

### Modified Capabilities
- `subagent`: Remove env var priority behavior from timeout resolution; remove unused session ID env var

## Impact

- `src/tools/subAgent.js` — resolveTimeout() function and child process spawn
- `tests/unit/tools/subAgent.test.js` — env var priority tests
- `config.yaml` — no changes needed (timeout already defined in process.subAgent section)
- No API changes, no breaking changes for users using config.yaml (which is the intended path)