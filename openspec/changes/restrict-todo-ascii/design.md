## Context

The `todo` tool (`src/tools/todo.js`) currently accepts any string for `key` and `content` fields. There is no character-level validation. This means Unicode characters — emojis, CJK, accented Latin, RTL text — pass through unfiltered. While this works in isolation, it creates downstream issues: terminal rendering inconsistencies, shell script incompatibility, and unpredictable storage behavior across platforms.

## Goals / Non-Goals

**Goals:**
- Enforce ASCII-only (code points 0–127) on `key` and `content` fields
- Strip non-ASCII characters silently (no error returned to caller)
- Add test coverage for Unicode stripping scenarios
- Maintain backward compatibility — no breaking API changes

**Non-Goals:**
- Rejecting input with errors (silent strip only)
- Locale/language detection or translation
- Configurable character sets (always ASCII-only, no toggle)
- Affecting other tools or fields beyond `key` and `content`

## Decisions

### 1. Strip, don't reject
**Decision**: Non-ASCII characters are silently removed rather than returning `{ ok: false, error: "..." }`.

**Rationale**: The user experience should not be penalized for accidentally including Unicode. A todo with content "Meet at café" becomes "Meet at caf" — still understandable, no friction. Rejecting would require the caller to retry, which is annoying for a non-critical field.

**Alternatives considered**:
- *Reject with error*: Better data purity, but worse UX for a tool that's called frequently by the agent.
- *Warn once, then strip*: Adds complexity (stateful warning) for marginal benefit.

### 2. Strip at the implementation layer, not the zod schema
**Decision**: Use a `.transform()` in the zod schema to strip non-ASCII characters from `key` and `content` before they reach `todoImpl`.

**Rationale**: Zod's `.transform()` runs before the handler function, keeping the stripping logic declarative and close to the schema definition. It also means `todoImpl` receives already-sanitized input — no conditional logic needed per action.

**Alternatives considered**:
- *Strip inside `todoImpl` per action*: More code duplication, harder to maintain.
- *Strip at the factory level*: Works, but the transform on the schema is more explicit about the constraint.

### 3. Use a regex for stripping
**Decision**: Use `/[^\x00-\x7F]/g` to match and remove all non-ASCII characters.

**Rationale**: Simple, well-understood, no external dependencies. The regex matches any character outside the 0–127 Unicode range.

**Alternatives considered**:
- *Character-by-character filter*: More verbose, same result.
- *`normalize('NFD')` + strip combining marks*: Only handles accented Latin, misses CJK, emojis, etc. Too narrow.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Stripping changes content meaningfully (e.g., "naïve" → "nave") | Acceptable trade-off; ASCII-only is a hard constraint. Document in spec. |
| Existing todos with Unicode become corrupted on next read | Not an issue — stripping only happens on *write*. Existing data is read as-is. |
| Zod transform adds overhead on every call | Negligible — regex replace on short strings is microseconds. |

## Migration Plan

No migration needed. The change is backward-compatible:
- Existing callers pass the same fields, same types
- Only the stored value changes (stripped)
- No database/schema migration required
