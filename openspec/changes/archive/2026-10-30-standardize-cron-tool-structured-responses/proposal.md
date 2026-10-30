# Proposal

## Why

The cron tool's `cronJobImpl` function returns `JSON.stringify({ ok, ...result })` strings from every return site. This forces callers to parse the response and makes the tool's contract inconsistent with other tools that return native structured objects. Standardizing to native structured objects improves consistency, type safety, and downstream consumption.

## What Changes

- `cronJobImpl` in `src/tools/cron/index.js` returns native structured objects instead of `JSON.stringify`-wrapped strings.
- On success, returns `{ ok: true, ...result }`; on failure, returns `{ ok: false, error }`.
- The `run` action passes through the nested `{ ok, ... }` result from `runJob` as a native object.
- The JSDoc `@returns` annotation on `cronJobImpl` is updated from `{Promise<string>} JSON result string` to `{Promise<object>} Structured result object`.
- Unit tests in `tests/unit/tools_cron.test.js` are updated to assert the native object shape directly instead of `JSON.parse`-ing a string.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `cron-scheduler`: The cron tool's `cronJobImpl` output contract changes from a `JSON.stringify`-wrapped string to a native structured object (`{ ok: true, ... }` on success, `{ ok: false, error }` on failure).

## Impact

- **Code**: `src/tools/cron/index.js` — `cronJobImpl` function and `cronJob` tool wrapper.
- **Tests**: `tests/unit/tools_cron.test.js` — assertions updated to native object shape.
- **Dependencies**: None. Pure refactor of return values.
- **Integration**: The `tool()` wrapper from `@langchain/core/tools` must pass through native objects without re-serializing.

## Non-goals

- No change to the cron tool's input schema, action set, or job persistence format.
- No change to the `runJob` helper's internal return shape.
- No new dependencies or configuration.
