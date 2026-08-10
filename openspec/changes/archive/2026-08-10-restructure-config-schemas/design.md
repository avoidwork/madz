## Context

The `src/config/schemas.js` file (293 lines) is a monolith containing Zod schemas for 9+ unrelated config sections: providers, sandbox, memory, telemetry, schedules, tui, agent, lru, and persistence. Each section is independently useful but bundled together, creating a file that is difficult to navigate and test. Additionally, `mutate.js` uses a vague name that doesn't convey its purpose.

## Goals / Non-Goals

**Goals:**
- Split schemas.js into per-section files under src/config/schemas/
- Maintain backward compatibility via index.js re-exports
- Rename mutate.js → patch.js
- Evaluate DEFAULT_CONFIG redundancy

**Non-Goals:**
- Changing any Zod validation rules
- Adding new config sections
- Restructuring loader.js

## Decisions

1. **Per-section files, not per-schema:** Each config section (e.g., "memory") gets one file containing all related schemas, not one file per individual schema. This keeps the number of files manageable (~10 files) while still achieving separation of concerns.

2. **Index.js re-exports:** The existing `schemas.js` import path is preserved via `src/config/schemas/index.js`. This ensures zero breaking changes for consumers.

3. **DEFAULT_CONFIG evaluation:** We will audit all consumers before deciding. If Zod `.default()` values are identical to DEFAULT_CONFIG values, we remove DEFAULT_CONFIG. Otherwise, we keep it as a plain-object convenience.

4. **Rename mutate.js → patch.js:** "Patch" better conveys the intent of applying changes to a config object.

## Risks / Trade-offs

- **More files:** The directory gains ~10 files. Mitigation: each file is small and focused (~20-40 lines).
- **Index.js indirection:** Standard practice, low risk.
- **DEFAULT_CONFIG removal:** If any consumer relies on it as a plain object, removal would break them. Mitigation: audit all consumers first.
