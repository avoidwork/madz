# Proposal

## Why

The `clarify` tool currently returns a `JSON.stringify({ answered, question, ... })` string from its impl function. This forces callers to parse the response and makes the tool's contract inconsistent with other tools that return native structured objects. Standardizing to native structured objects improves consistency, type safety, and downstream consumption.

## What Changes

- Change `clarifyImpl` in `src/tools/clarify/index.js` to return a native structured object instead of a `JSON.stringify`-wrapped string.
- On success, return `{ ok: true, answered: true, question, ...(choices), answer, source }`.
- On failure, return `{ ok: false, error }`.
- Update the JSDoc `@returns` annotations to reflect the new structured return type.
- Update unit tests to assert the structured shape (native object, not string).

## Capabilities

### New Capabilities
<!\-\- None \-\->

### Modified Capabilities
- `clarify-tool`: The `clarify` tool's return contract changes from a `JSON.stringify`-wrapped string to a native structured object. The success return adds an `ok: true` field; the failure path returns `{ ok: false, error }`. The existing requirements about echoing the question, interrupting the agent, and returning the `answer` field are preserved.

## Impact

- `src/tools/clarify/index.js` — convert return to native object, update JSDoc.
- `tests/unit/tools_clarify.test.js` — update helper to not `JSON.parse`, assert `ok` field, add failure-path test.
- No new dependencies.

## Non-goals

- No change to the `tool()` wrapper or the LangGraph interrupt mechanism.
- No change to the TUI's clarify handling (it consumes the interrupt value, not the impl return).
- No new dependencies.
