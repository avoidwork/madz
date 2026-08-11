## Context

`src/logger.js` is a cross-cutting logging utility (Pino-based structured JSON logger) that currently sits at the root of `./src/` alongside 12 subdirectories. It is imported by multiple modules across the codebase. Its current location is an organizational anomaly — it does not belong at the root level.

## Goals / Non-Goals

**Goals:**
- Move `src/logger.js` to `src/shared/logger.js`
- Update all import paths to reference the new location
- Preserve all functionality — zero behavioral changes

**Non-Goals:**
- Modifying logger internals or API surface
- Adding new logging capabilities
- Creating a barrel index in `src/shared/`

## Decisions

1. **Directory: `src/shared/`** — Chosen over `src/utils/` per the issue analysis. `shared` is the canonical location for cross-cutting infrastructure utilities.
2. **No barrel index** — Since logger.js is the only file in `src/shared/`, no `index.js` is created. Importers reference `src/shared/logger.js` directly.
3. **Relative imports** — Each importer updates its path relative to its own location. No absolute path rewrites.

## Risks / Trade-offs

- **Risk:** Missing a dynamic import or string-based require → **Mitigation:** Full codebase grep for all logger references before and after the move.
- **Risk:** Circular dependency introduced by new path → **Mitigation:** Verify with `npm start` and test suite.

## Migration Plan

1. Create `src/shared/` directory
2. Move `src/logger.js` → `src/shared/logger.js`
3. Update all import paths
4. Run tests and verify application starts

## Open Questions

None.
