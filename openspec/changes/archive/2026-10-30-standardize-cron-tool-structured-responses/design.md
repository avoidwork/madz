# Design

## Context

See proposal.md - Why. The `cronJobImpl` function in `src/tools/cron/index.js` currently wraps every return value in `JSON.stringify({ ok, ... })`. The `cronJob` tool is registered via `tool()` from `@langchain/core/tools`, which wraps `cronJobImpl` and exposes it to the agent as a callable tool.

## Goals / Non-Goals

**Goals:**
- Return native structured objects from `cronJobImpl` on all paths (success, failure, and the `run` action's nested result).
- Update the JSDoc `@returns` annotation to reflect the native object return type.
- Update unit tests to assert the native object shape directly.

**Non-Goals:**
- No change to the tool's input schema, action set, or job persistence format.
- No change to the `runJob` helper's internal return shape.
- No change to the `tool()` wrapper's registration or schema.

## Decisions

**Decision: Convert all `JSON.stringify({ ok, ... })` returns to native object returns.**
The change is mechanical: each `return JSON.stringify({ ok: true, ...result })` becomes `return { ok: true, ...result }`, and each `return JSON.stringify({ ok: false, error: ... })` becomes `return { ok: false, error: ... }`. The `run` action's `return JSON.stringify(result)` becomes `return result` since `result` is already a native `{ ok, ... }` object from `runJob`. The catch block's `return JSON.stringify({ ok: false, error: ... })` becomes `return { ok: false, error: ... }`.

*Alternatives considered:*
- Keep returning strings — rejected because it forces callers to parse and is inconsistent with structured-object conventions.
- Return a bare string on success and throw on failure — rejected because it does not provide a consistent structured contract.

**Decision: Update JSDoc `@returns` to `{Promise<object>}`.**
The `cronJobImpl` JSDoc currently declares `@returns {Promise<string>} JSON result string`. This must change to `@returns {Promise<object>} Structured result object`. The `cronJob` tool wrapper's `@returns` annotation is updated similarly.

**Decision: Update tests to assert native object shape.**
The existing tests in `tests/unit/tools_cron.test.js` call `JSON.parse(result)` on the impl output. After the change, `result` is already a native object, so `JSON.parse` would throw. Each `JSON.parse(result)` is replaced with direct property access (e.g., `result.ok`, `result.job.name`). A new assertion verifies the result is a native object (not a string) on both success and failure paths.

## Risks / Trade-offs

- [The `tool()` wrapper may re-serialize native objects] → Verify the wrapper passes through native objects without re-serializing. The `@langchain/core/tools` `tool()` wrapper returns the function's return value as-is; no re-serialization occurs.
- [Tests that rely on `JSON.parse` will break] → Update all `JSON.parse(result)` calls in the test file to direct object access. This is a mechanical but broad change.
- [The `run` action's nested result shape] → The `runJob` helper returns `{ ok, result }` or `{ ok, error }`. Passing it through as a native object preserves the existing shape.

## Migration Plan

No migration required. This is a pure refactor of return values with no persistence or schema changes. Rollback is a revert of the source and test changes.

## Open Questions

None.
