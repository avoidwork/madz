# Proposal

## Why

The `discovery` tool's impl functions (`lsImpl`, `globImpl`, `grepImpl`, `discoveryImpl`) currently return bare strings — e.g. `entries.join("\n")`, `Found N matches`, or raw grep output. Consumers cannot reliably distinguish success from failure or parse returned data. Standardizing to structured objects enables programmatic handling, consistent error propagation, and reliable downstream processing.

## What Changes

- Refactor `lsImpl`, `globImpl`, `grepImpl`, and `discoveryImpl` in `src/tools/discovery/index.js` to return structured objects.
- On success return `{ ok: true, ... }` with relevant data (`entries`, `matches`, `count`).
- On failure return `{ ok: false, error: ... }`.
- Update JSDoc `@returns` annotations from `{Promise<string>}` to `{Promise<{ok: boolean, ...}>}`.
- Update `tests/unit/tools/discovery.test.js` and `tests/integration/tools/discovery.test.js` to assert the structured shapes.

## Capabilities

### New Capabilities
<!-- None introduced. -->

### Modified Capabilities
- `discovery-tool`: The `discovery` tool's responses change from bare strings to structured objects (`{ ok, ... }`). Success returns `{ ok: true, ... }`; failure returns `{ ok: false, error }`. This is a spec-level behavior change affecting all actions (ls, glob, grep) and the unknown-action error path.

## Impact

- `src/tools/discovery/index.js` — refactor impls to structured returns, update JSDoc.
- `tests/unit/tools/discovery.test.js` — assert structured shapes.
- `tests/integration/tools/discovery.test.js` — assert structured shapes.
- No new dependencies; pure refactor of existing code.

## Non-goals

- No change to other tools or their response formats.
- No change to the `discovery` tool's schema, actions, or permission model.
- No new npm packages or system dependencies.
