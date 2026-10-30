# Design

## Context

See proposal.md - Why. The `browser` tool's `browserImpl` function in `src/tools/browser/index.js` currently wraps every return value in `JSON.stringify({...})`, forcing callers to `JSON.parse` the response. This is inconsistent with the rest of the toolset, which returns native structured objects. The change is a pure refactor of return values plus JSDoc and test updates.

## Goals / Non-Goals

**Goals:**
- Convert the four `JSON.stringify({...})` return statements in `browserImpl` to return native objects.
- Update the JSDoc `@returns` annotations on `browserImpl` and the `browser` tool definition.
- Update unit tests to assert the impl returns a native object (not a string) and to access properties directly.
- Preserve all existing behavior (URL validation, session management, action semantics, error messages).

**Non-Goals:**
- No change to the Zod schema, session registry, or the `runAction` internal helper (it already returns native objects).
- No change to the `tool()` wrapper behavior — it passes native objects through without re-serializing.
- No new dependencies, no new credentials, no change to SSRF protection or error message content.

## Decisions

### Decision 1: Return native objects directly from `browserImpl`
The four `JSON.stringify({...})` return statements become plain object literals:
- Success path: `return { ...result, sessionId };`
- Close path: `return { ok: true, action: "close" };`
- URL-rejected path: `return { ok: false, error: ... };`
- Catch path: `return { ok: false, error: ..., sessionId };`

**Rationale:** The `tool()` wrapper from `@langchain/core/tools` passes the returned value through to the caller without re-serializing objects. Returning a native object is the intended contract and matches the rest of the toolset. `runAction` already returns native objects, so the success path simply spreads `result` into the returned object.

**Alternatives considered:**
- Keep returning `JSON.stringify` strings — rejected because it forces callers to parse and is inconsistent with structured-object conventions.
- Return a bare string on success and throw on failure — rejected because it does not provide a consistent structured contract.

### Decision 2: Update JSDoc to reflect native object return
- `browserImpl`: `@returns {Promise<string>} JSON result string` → `@returns {Promise<object>} Structured result object`.
- `browser` tool definition: `@returns {string} JSON result string` → `@returns {object} Structured result object`.

**Rationale:** The JSDoc must accurately describe the return type. This is documentation-only and has no runtime effect.

### Decision 3: Update unit tests to consume native objects
Replace every `JSON.parse(result)` in `tests/unit/tools/browser.test.js` with direct property access on the returned value, and add assertions that the returned value is a native object (`typeof result === "object"` and not a string).

**Rationale:** The tests currently parse the stringified response. With native objects, `JSON.parse` would throw (or coerce incorrectly), so all `browserImpl` tests must be updated. The `BrowserToolSchema` tests are unaffected.

## Risks / Trade-offs

- **[Breaking contract change]** → Callers that currently `JSON.parse` the stringified response will break. This is the intended change described in the issue; the unit tests are updated to reflect the new contract, and any downstream consumers must adapt.
- **[Error message content]** → The existing `Browser action failed: ${err.message}` format is preserved to avoid leaking stack traces or secrets. No change to error content.
- **[Test coverage]** → The `close` test and error tests must still assert `ok` and `error` fields correctly on native objects. Verified by running the full test suite.

## Migration Plan

1. Update `browserImpl` return statements.
2. Update JSDoc annotations.
3. Update `tests/unit/tools/browser.test.js`.
4. Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm no regressions.

Rollback: revert the branch; the change is isolated to `src/tools/browser/index.js` and its unit test.

## Open Questions

None.
