## Context

The `./src/config` module handles configuration loading, validation, mutation, and persistence. It consists of three files:
- `loader.js` — YAML parsing, env var resolution, deep merge, config load/save/mutate
- `mutate.js` — Dot-path assignment and validation for config mutations
- `schemas.js` — Zod schemas for config validation and DEFAULT_CONFIG

The audit-code scan identified five issues: missing error handling in YAML parsing, in-memory/disk state divergence on write failure, duplicate code, dead schemas, and missing input validation.

## Goals / Non-Goals

**Goals:**
- Eliminate crash risk from malformed config.yaml
- Eliminate in-memory/disk state divergence in setConfigValue()
- Remove duplicate _parseValue() implementation
- Remove three dead provider schemas
- Add input validation guard to assignPath()
- Add test coverage for all new behavior

**Non-Goals:**
- No changes to ConfigSchema structure or DEFAULT_CONFIG values
- No new configuration options or capabilities
- No changes to env var resolution logic (only the parseValue source changes)
- No changes to ProvidersSchema.passthrough() behavior

## Decisions

### 1. Malformed YAML → fallback to DEFAULT_CONFIG
**Decision:** Treat malformed config.yaml the same as missing config.yaml — fall back to DEFAULT_CONFIG.
**Rationale:** A malformed file is as bad as no file. The operator needs the app to start, not crash. Logging the error gives visibility without blocking startup.
**Alternatives considered:**
- Throw and crash: worse UX, breaks startup
- Merge what we can: complex, error-prone, YAML parser doesn't support partial parse

### 2. Persist-first mutation order in setConfigValue()
**Decision:** Write to disk first, then mutate in-memory. On write failure, throw without mutating.
**Rationale:** The current order (mutate then persist) creates a window where memory and disk disagree. Reversing the order eliminates this window entirely. The trade-off is that a successful mutation now requires a successful disk write first, which is slightly slower but correct.
**Alternatives considered:**
- Keep current order and add rollback: complex, error-prone, what if rollback also fails?
- Use a transaction log: overkill for a single config file
- Write to temp file then rename: atomic on POSIX, but adds complexity for marginal gain

### 3. Import parseValue from mutate.js
**Decision:** Remove _parseValue() from loader.js, import parseValue from mutate.js.
**Rationale:** Byte-identical functions are a maintenance burden. mutate.js already exports parseValue, so the import is trivial.
**Alternatives considered:**
- Keep both: violates DRY, future divergences likely
- Move parseValue to a shared utils module: over-engineering for one function

### 4. Remove dead provider schemas
**Decision:** Remove _OpenaiProviderConfigSchema, _OpenrouterProviderConfigSchema, _FalProviderConfigSchema.
**Rationale:** They are prefixed with `_` (private), never referenced in ConfigSchema or DEFAULT_CONFIG, and ProvidersSchema.passthrough() accepts any provider config anyway. They serve no purpose.
**Alternatives considered:**
- Keep them commented out: dead code is still dead code
- Reference them in ProvidersSchema: unnecessary complexity, passthrough already handles it

### 5. assignPath() object guard
**Decision:** Throw descriptive Error if obj is null, undefined, or not an object. Allow arrays (they are objects in JS).
**Rationale:** The function assumes obj is a valid target for dot-path assignment. Without validation, callers get confusing errors deep in the loop. A guard at the top gives clear feedback.
**Alternatives considered:**
- Coerce to object: silent coercion hides bugs
- Return false on invalid input: changes the function's contract (it throws on other errors)

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Persist-first order means write failures block mutations | This is the point — we want mutations to fail if they can't be persisted |
| Importing parseValue from mutate.js creates a circular dependency risk | mutate.js imports from schemas.js, loader.js imports from both — no cycle |
| Removing dead schemas might surprise future developers who expect them | The `_` prefix and lack of references make it clear they were never used |
| assignPath() guard might break unexpected callers | Low risk — assignPath is internal, called only from applyDotPathMutation which always passes a valid object |

## Migration Plan

No migration needed. All changes are internal implementation fixes:
1. Deploy to non-production environment first
2. Verify config.yaml loads correctly (both present and absent cases)
3. Verify setConfigValue() persists and mutates correctly
4. Verify existing tests pass
5. Rollback: revert branch — no data migration or schema changes to undo

## Open Questions

None. All five findings are well-scoped with clear fixes.