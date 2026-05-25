## 1. Create the config mutator module

- [x] 1.1 Create `src/config/mutate.js` with exports `setConfigValueAt()`, `assignPath()`, and `parseValue()`
- [x] 1.2 Implemented `applyDotPathMutation(config, dotPath, valueStr)` — clones config, parses value, assigns dot-path, validates with zod, applies to original. Caller persists via saveConfig().
- [x] 1.3 Implemented standalone `parseValue(str)` for boolean/number/string coercion
- [x] 1.4 Implemented standalone `assignPath(patched, dotPath, value)` for dot-path mutation with intermediate object creation

## 2. Update the config loader

- [x] 2.1 Import `applyDotPathMutation` from `mutate.js` in `src/config/loader.js`
- [x] 2.2 Remove the duplicate `parseValue` and `assignPath` functions from `loader.js` (they are now in `mutate.js`)
- [x] 2.3 `saveConfig()` in `loader.js` remains the single YAML serialization entry point, called by `setConfigValue` after `applyDotPathMutation`

## 3. Write tests for the config mutator

- [x] 3.1 Create `tests/unit/config/mutate.test.js` testing `parseValue()` (booleans, integers, floats, negatives, strings, empty string)
- [x] 3.2 Create `tests/unit/config/mutate.test.js` testing `assignPath()` (nested values, intermediate objects, overwrites, mid-level paths)
- [x] 3.3 Create `tests/unit/config/mutate.test.js` testing `applyDotPathMutation()` with zod validation (int, boolean, string)
- [x] 3.4 Test for zod rejection when mutation violates the schema (e.g., invalid type)
- [x] 3.5 Test that `applyDotPathMutation` creates intermediate objects for deep paths
- [x] 3.6 Remove duplicates from `tests/unit/config.test.js` (mutation engine tests moved to `mutate.test.js`)

## 4. Verify the change

- [x] 4.1 `npm run lint` passes — no errors
- [x] 4.2 `npm run test` — all 207 tests pass
- [x] 4.3 `npm run coverage` — generated `coverage.txt`
