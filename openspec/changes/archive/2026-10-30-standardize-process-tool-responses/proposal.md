# Proposal

## Why

The `process` tool currently returns an inconsistent mix from `unifiedProcessImpl` — some paths return bare strings and others return `JSON.stringify(entries)`. This inconsistency makes the response contract unpredictable: callers cannot rely on a single shape, must special-case each path, and cannot inspect errors as structured objects.

## What Changes

- **BREAKING**: `unifiedProcessImpl` in `src/tools/process/index.js` now returns a native structured object on every path: `{ ok: true, ... }` on success and `{ ok: false, error: ... }` on failure.
- The `list` action returns `{ ok: true, entries: [...] }` instead of `JSON.stringify(entries)`.
- Helpers `executeForeground` and `executeBackground` return native objects instead of bare strings.
- JSDoc `@returns` on `unifiedProcessImpl` and the helpers is updated to document the structured shape.
- Unit tests in `tests/unit/tools/process.test.js` are updated to assert the object shape across all actions and error paths.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `unified-process-tool`: the response contract of the `process` tool changes from mixed strings to native structured objects (`{ ok: true, ... }` / `{ ok: false, error: ... }`). The `list` action now returns an `entries` array field rather than a JSON string. This is a spec-level behavior change to the tool's return shape.

## Impact

- `src/tools/process/index.js` — `unifiedProcessImpl`, `executeForeground`, `executeBackground` return shapes and JSDoc.
- `tests/unit/tools/process.test.js` — assertions updated to the structured object shape.
- No changes to `processTracker` or `trackProcess` API.
- No changes to the tool's input schema or action routing.

## Non-goals

- No change to the tool's input schema, action enum, or process tracking internals.
- No change to other tools or the deepagents tool set.
- No change to the `processTracker` data model or `trackProcess` export.
