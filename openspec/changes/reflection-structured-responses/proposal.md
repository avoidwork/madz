# Proposal

## Why

The `reflection` tool currently returns `JSON.stringify(results)` from `reflectionImpl`, forcing every caller to parse the response before use. This is inconsistent with tools that return native objects and makes error handling fragile — a stringified error cannot be inspected as a structured object.

## What Changes

- **Structured success response:** `reflectionImpl` returns `{ ok: true, results }` instead of `JSON.stringify(results)`.
- **Structured empty response:** Empty results return `{ ok: true, results: [] }` — an empty result set is a successful outcome, not an error.
- **Structured failure response:** A genuine failure (the `find` command throwing) returns `{ ok: false, error: <message> }`.
- **JSDoc update:** The `@returns` annotation on `reflectionImpl` documents the new structured shape.
- **Test updates:** Unit tests assert the object shape on success, empty, and failure paths.

## Capabilities

### New Capabilities
- `reflection-tool`: The reflection tool's session-reading behavior, including its structured response contract (`{ ok: true, results }` on success, `{ ok: false, error }` on failure).

### Modified Capabilities
- None. The `reflection-summary` capability (the reflection skill's narrative generation) is unaffected — only the tool's response shape changes.

## Impact

- **Affected code:** `src/tools/reflection/index.js` (return paths and JSDoc), `tests/unit/tools_reflection.test.js` (assertions).
- **Dependencies:** No new dependencies — this is a pure refactor of return values.
- **Memory:** The `memory/sessions/` directory structure is unchanged.
- **Testing:** Existing tests that `JSON.parse()` the result must be updated to assert on the `ok`/`results` fields.

## Non-goals

- Modifying the reflection tool's filtering logic, input schema, or session parsing.
- Changing the `reflection-summary` skill's narrative generation.
- Adding a wrapper class or new dependencies.
