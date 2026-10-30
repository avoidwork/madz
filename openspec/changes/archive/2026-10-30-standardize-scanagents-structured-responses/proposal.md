# Proposal

## Why

The `scanAgents` tool currently returns a bare markdown string from `scanAgentsImpl`, which delegates to `loadAgents` and returns a markdown string. This is inconsistent with the structured-object convention (`{ ok: true, ... }` / `{ ok: false, error: ... }`) used elsewhere in the codebase (e.g., `src/tools/web/index.js`, `src/tools/image/index.js`, `src/tools/calendar/index.js`). Returning a structured object makes the response self-describing and lets consumers distinguish success from failure without parsing.

## What Changes

- Modify `scanAgentsImpl` in `src/tools/scanAgents/index.js` to return a native structured object instead of a bare markdown string.
- On success, return `{ ok: true, agents: <markdown string> }`.
- On path-validation failure, return `{ ok: false, error: <message> }`.
- Update the JSDoc `@returns` annotation to reflect the new shape.
- Update existing tests in `tests/unit/tools_scanAgents.test.js` to assert the new structured shape.
- The `loadAgents` function itself is unchanged — the conversion happens at the `scanAgentsImpl` boundary.

## Capabilities

### New Capabilities
<!\-\- None introduced. \-\->

### Modified Capabilities
- `scan-agents`: The return shape of the `scanAgents` tool changes from a bare string to a structured object. On success the tool SHALL return `{ ok: true, agents }`; on path-validation failure it SHALL return `{ ok: false, error }`. The "no AGENTS.md found" case remains a successful result (`{ ok: true, agents: "" }`), and the file-size-limit failure maps to `{ ok: false, error }`.

## Impact

- **Code**: `src/tools/scanAgents/index.js` — `scanAgentsImpl` return values and JSDoc.
- **Tests**: `tests/unit/tools_scanAgents.test.js` — update assertions to the structured shape.
- **Dependencies**: None — pure refactor of existing code.
- **Systems**: Tool consumers that parse the `scanAgents` response will now receive a structured object. No config schema changes.

## Non-goals

- Not changing the `loadAgents` workspace utility's return type.
- Not changing the `scanAgents` tool's input schema or permission tier.
- Not introducing new dependencies or new tool capabilities.
