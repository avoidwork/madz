# Design

## Context

See proposal.md - Why. The `sampling` tool's `samplingImpl` function in `src/tools/sampling/index.js` returns `JSON.stringify({...})` strings at four points (empty content, cooldown, capacity, and success). The singleton `sampling` wrapper then calls `JSON.parse(result)` to read `parsed.ok` and `parsed.createdAt`.

## Goals / Non-Goals

**Goals:**
- Return native structured objects from `samplingImpl` on all paths.
- Update the singleton wrapper to read the native object directly.
- Update unit tests to assert the native object shape.

**Non-Goals:**
- No change to `SamplingSchema`, cooldown/capacity/TTL logic, or tool registration.

## Decisions

**Decision: Return native objects instead of `JSON.stringify` strings.**
- Rationale: The issue requires standardizing to native structured objects for consistency with other tools and to avoid forcing callers to parse.
- Alternatives considered: Keep returning strings (rejected — inconsistent); return bare string on success and throw on failure (rejected — no consistent structured contract).

**Decision: Update the singleton wrapper to read the object directly.**
- Rationale: Since `samplingImpl` now returns a native object, `JSON.parse(result)` is no longer needed. Replace with `const parsed = result;`. The `_lastWritten` update logic (`if (parsed.ok && parsed.createdAt)`) is preserved unchanged.

**Decision: Update JSDoc `@returns` annotation.**
- Rationale: The current `{Promise<string>} Result JSON string` no longer reflects the actual return type. Change to `{Promise<object>} Structured result object`.

## Risks / Trade-offs

- [Callers that relied on the string return] → This is the intended breaking contract change; the issue explicitly requests it. The singleton wrapper is updated in the same change to avoid a mismatch.
- [Tests that `JSON.parse` the result] → Updated in the same change to assert the native object shape.

## Migration Plan

No deployment migration required. The change is a single commit on the feature branch, merged via PR.

## Open Questions

None.
