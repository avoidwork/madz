## Context

See proposal.md - Why. The `generateImageImpl` function in `src/tools/image/index.js` wraps every return value in `JSON.stringify(...)`, while the `generateWithFal` helper (line 14) already returns native `{ ok, imageUrl?, error? }` objects. The change removes the stringification so the impl returns native objects directly.

## Goals / Non-Goals

**Goals:**
- Make `generateImageImpl` return native `{ ok, ... }` objects on every path.
- Update the JSDoc `@returns` on both `generateImageImpl` and the `generateImage` tool wrapper.
- Add/update unit tests asserting the object shape.

**Non-Goals:**
- No change to the `generateImage` Zod schema or tool registration.
- No change to `generateWithFal`'s logic or the FAL.ai API call.

## Decisions

### Decision 1: Return native objects, not a wrapper class
A plain `{ ok, ... }` object matches the existing `generateWithFal` helper and other tools in the codebase. A wrapper class is over-engineering for a simple structured result.

- **Alternative considered:** Keep `JSON.stringify` strings — rejected because it forces callers to parse and is inconsistent with native-object tools.
- **Alternative considered:** Return a wrapper class — rejected as over-engineering.

### Decision 2: Update JSDoc to reflect the structured shape
Both `generateImageImpl` and the `generateImage` tool wrapper document `@returns {string}`. These are updated to `@returns {Promise<{ ok: boolean, imageUrl?: string, error?: string }>}` to accurately describe the native object return type.

## Risks / Trade-offs

- **[Callers relying on `JSON.parse` may break]** → The issue explicitly requests this change; callers are expected to consume native objects directly. Tests are updated to assert the object shape.
- **[FAL error path requires mocking]** → The FAL error path test must mock `generateWithFal` or the underlying fetch; follow the project's existing `node --test` mocking patterns.

## Migration Plan

No deployment migration needed — this is a source-level change to a tool's return shape. Callers of `generateImage` must consume the native object instead of `JSON.parse`-ing a string.

## Open Questions

None.
