# Design

## Context

See proposal.md - Why. The `reflectionImpl` function in `src/tools/reflection/index.js` currently returns `JSON.stringify`-wrapped strings on every path. This is a localized refactor of return values with no architectural or dependency changes.

## Goals / Non-Goals

**Goals:**
- Convert all `reflectionImpl` return paths to native structured objects.
- Update the JSDoc `@returns` annotation.
- Update unit tests to assert the new object shape.

**Non-Goals:**
- Changing the tool's filtering logic, input schema, or session parsing.
- Modifying the `reflection-summary` skill.
- Adding new dependencies or a wrapper class.

## Decisions

### Decision 1: Empty results are success, not error
**Choice:** Return `{ ok: true, results: [] }` when no sessions match, rather than `{ ok: false }`.
**Rationale:** The issue explicitly states empty results should be `{ ok: true, results: [] }`. An empty result set is a valid, successful outcome — not a failure. Only a genuine failure (the `find` command throwing) returns `{ ok: false, error }`.

### Decision 2: Native object, not a wrapper class
**Choice:** Return a plain structured object `{ ok: true, results }` / `{ ok: false, error }`.
**Rationale:** The issue rejects a wrapper class as over-engineering. A plain object is sufficient and consistent with other tools that return native objects.

### Decision 3: Failure path is the `find` exec catch
**Choice:** The `find` command failure (currently `return JSON.stringify([])` in the catch block) becomes the `{ ok: false, error }` path.
**Rationale:** This is the only genuine error path in `reflectionImpl`. The empty-lines path (line 134) is a successful empty result, not an error.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Callers that `JSON.parse()` the result break | The only caller is the `reflectionSessions` tool wrapper, which passes the value through to LangChain unchanged. Tests are the primary consumers that need updating. |
| LangChain tool serialization of native objects | LangChain serializes tool return values to JSON for the LLM, so returning a native object is correct behavior. |

## Migration Plan

1. Modify `src/tools/reflection/index.js` return paths and JSDoc.
2. Update `tests/unit/tools_reflection.test.js` assertions.
3. Run `npm run test`, `npm run lint`, `npm run coverage`.
4. No rollback needed — the change is backward-incompatible only for callers that parsed the string, which is the intended fix.

## Open Questions

None.
