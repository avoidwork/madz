# Design

## Context

See proposal.md - Why. The `clarifyImpl` function in `src/tools/clarify/index.js` returns a `JSON.stringify({ answered, question, ... })` string at line 73. The `tool()` wrapper from `@langchain/core/tools` wraps `clarifyImpl` and passes through its return value. The test helper in `tests/unit/tools_clarify.test.js` currently calls `JSON.parse(raw)` on the result.

## Goals / Non-Goals

**Goals:**
- Return a native structured object from `clarifyImpl` on both success and failure paths.
- Preserve all existing fields (`answered`, `question`, `choices`, `answer`, `source`).
- Update JSDoc and tests to reflect the structured contract.

**Non-Goals:**
- No change to the `tool()` wrapper or the LangGraph `interrupt()` mechanism.
- No change to the TUI's clarify handling (it consumes the interrupt value, not the impl return).
- No new dependencies.

## Decisions

**Decision: Return `{ ok: true, ... }` on success and `{ ok: false, error }` on failure.**
- Rationale: The `ok` field provides a consistent, inspectable success/failure contract across all tools. This matches the issue's proposed contract.
- Alternative considered: Return a bare object without `ok` — rejected because it provides no explicit success/failure signal.
- Alternative considered: Keep returning a string — rejected because it forces callers to parse and is inconsistent with structured-object conventions.

**Decision: Wrap the existing return in a native object literal instead of `JSON.stringify`.**
- Rationale: The `tool()` wrapper passes through native objects without re-serializing, so no wrapper change is needed. The `interrupt()` value (which carries the question/choices for the TUI) is unaffected.

**Decision: Add a failure path returning `{ ok: false, error }`.**
- Rationale: The issue requires a consistent structured contract on failure. The current impl has no explicit failure return; wrapping the body in a try/catch that returns `{ ok: false, error }` preserves the contract without leaking stack traces.

## Risks / Trade-offs

- [Existing callers that `JSON.parse` the result] → The only in-repo caller is the test helper, which is updated in the same change. External consumers must be updated to read the native object.
- [Error messages leaking internals] → The failure path returns a sanitized error message; no stack traces or secrets are included.
