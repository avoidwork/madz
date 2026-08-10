## 1. Create schema directory structure

- [ ] 1.1 Create `src/config/schemas/` directory
- [ ] 1.2 Audit `src/config/schemas.js` to identify all schema sections and their boundaries

## 2. Extract per-section schema files

- [ ] 2.1 Extract providers schema → `src/config/schemas/providers.js`
- [ ] 2.2 Extract sandbox schema → `src/config/schemas/sandbox.js`
- [ ] 2.3 Extract memory schema → `src/config/schemas/memory.js`
- [ ] 2.4 Extract telemetry schema → `src/config/schemas/telemetry.js`
- [ ] 2.5 Extract schedules schema → `src/config/schemas/schedules.js`
- [ ] 2.6 Extract tui schema → `src/config/schemas/tui.js`
- [ ] 2.7 Extract agent schema → `src/config/schemas/agent.js`
- [ ] 2.8 Extract lru schema → `src/config/schemas/lru.js`
- [ ] 2.9 Extract persistence schema → `src/config/schemas/persistence.js`

## 3. Create index.js re-exports

- [ ] 3.1 Create `src/config/schemas/index.js` re-exporting all schemas
- [ ] 3.2 Verify all existing import patterns still resolve correctly

## 4. Evaluate DEFAULT_CONFIG

- [ ] 4.1 Find all consumers of DEFAULT_CONFIG using grep
- [ ] 4.2 Compare DEFAULT_CONFIG values against Zod `.default()` values
- [ ] 4.3 Remove DEFAULT_CONFIG if redundant, or preserve if needed

## 5. Rename mutate.js → patch.js

- [ ] 5.1 Rename `src/config/mutate.js` → `src/config/patch.js` using `git mv`
- [ ] 5.2 Find and update all import paths referencing `mutate.js`
- [ ] 5.3 Verify no remaining references to `mutate` in import statements

## 6. Remove old schemas.js

- [ ] 6.1 Remove `src/config/schemas.js` (replaced by schemas/ directory)
- [ ] 6.2 Verify no remaining imports reference the old file

## 7. Verify and test

- [x] 7.1 Run `npm test` to verify all tests pass
- [x] 7.2 Run `npm start` with timeout to verify application starts
- [x] 7.3 Verify config loading works with new structure
