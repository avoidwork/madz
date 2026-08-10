## Why

The `src/config/schemas.js` file at 293 lines contains Zod schemas for 9+ unrelated config sections plus a DEFAULT_CONFIG object that duplicates structure already defined by Zod `.default()` calls. This monolithic file violates single-responsibility principles, making it hard to navigate, test, and maintain. Splitting it into focused per-section files reduces cognitive load and enables independent testing of each schema.

## What Changes

- Create `src/config/schemas/` directory with per-section schema files
- Replace `src/config/schemas.js` with `src/config/schemas/index.js` that re-exports all schemas (backward compatible)
- Evaluate and potentially remove DEFAULT_CONFIG if redundant with Zod defaults
- Rename `src/config/mutate.js` → `src/config/patch.js` and update all imports

## Capabilities

### New Capabilities
- `config-schemas`: Modular schema organization with per-section Zod schemas and re-export index

### Modified Capabilities
- None — structural refactoring with no spec-level behavior changes

## Impact

- Affected code: `src/config/schemas.js`, `src/config/mutate.js`, all files importing from either
- No API changes — Zod validation behavior preserved
- No dependency changes

## Non-goals

- Adding new config sections or schemas
- Changing Zod validation rules or default values
- Restructuring `loader.js` or `patch.js` beyond the rename
