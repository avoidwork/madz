# Proposal

## Why

The `sampling` tool currently returns a `JSON.stringify({...})` string from its impl function. This forces callers to parse the response and makes the tool's contract inconsistent with other tools that return native structured objects. Standardizing to native structured objects improves consistency, type safety, and downstream consumption.

## What Changes

- Modify `samplingImpl` in `src/tools/sampling/index.js` to return native structured objects instead of `JSON.stringify`-wrapped strings:
  - Success: `{ ok: true, message, createdAt, expiresAt, path }`
  - Failure (empty content, cooldown, capacity): `{ ok: false, error }`
- Update the `sampling` tool singleton wrapper to read the native object directly (remove `JSON.parse`).
- Update the JSDoc `@returns` annotation on `samplingImpl` to reflect the native structured object return.
- Update unit tests in `tests/unit/tools_sampling.test.js` to assert the native object shape.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `ephemeral-sampling`: The sampling tool's return contract changes from a `JSON.stringify` string to a native structured object (`{ ok: true, ... }` on success, `{ ok: false, error }` on failure). The scenarios describing the tool's success and failure responses are updated to reflect the native object shape.

## Impact

- `src/tools/sampling/index.js` — convert four `JSON.stringify` returns to native objects; update the singleton wrapper to read the object directly; update JSDoc.
- `tests/unit/tools_sampling.test.js` — update tests to assert native object shape.
- No new dependencies.

## Non-goals

- No change to the `SamplingSchema` validation.
- No change to the cooldown, capacity, or TTL logic.
- No change to other tools or the tool registration in `src/tools/index.js`.
