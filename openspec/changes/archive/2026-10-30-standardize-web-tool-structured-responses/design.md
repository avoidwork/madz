# Design

## Context

See proposal.md - Why. The `searchWebImpl` function in `src/tools/web/index.js` currently returns `JSON.stringify({ ok, backend, query, results })` strings at three points. The `searchWeb` tool wraps `searchWebImpl` via the `@langchain/core/tools` `tool()` helper. This is a pure refactor of return values with no new dependencies.

## Goals / Non-Goals

**Goals:**
- Return native structured objects from `searchWebImpl` on both success and failure paths.
- Update JSDoc annotations to reflect the native object return type.
- Update unit tests to assert the native object shape.

**Non-Goals:**
- No change to search backend implementations.
- No change to the `searchWeb` input schema or `detectSearchBackend`.
- No change to configuration handling.

## Decisions

### Decision: Return native objects directly instead of `JSON.stringify` strings

The three `return JSON.stringify({...})` statements in `searchWebImpl` are converted to return the object literal directly. This removes the serialization/deserialization round-trip and makes the tool's contract consistent with other tools that return structured objects.

**Alternatives considered:**
- Keep returning strings — rejected because it forces callers to parse and is inconsistent with structured-object conventions.
- Return a bare string on success and throw on failure — rejected because it does not provide a consistent structured contract.

### Decision: Preserve the exact error message strings

The error messages (`"Query is required and must be a non-empty string"` and `result.error`) are preserved verbatim to avoid breaking any downstream consumers that match on the error text.

### Decision: Verify the `tool()` wrapper passes through native objects

The `@langchain/core/tools` `tool()` helper returns the value from the wrapped function as-is. Native objects pass through unchanged, so no re-serialization occurs at the integration point. This is verified by the existing test suite and the unit tests updated in this change.

## Risks / Trade-offs

- [Callers that currently `JSON.parse` the returned string will break] → This is an intentional breaking change; the unit tests are updated to consume the native object directly, and the PR description documents the contract change.
- [The `tool()` wrapper might re-serialize the return value] → Verified by the integration point and unit tests; the wrapper passes native objects through unchanged.
