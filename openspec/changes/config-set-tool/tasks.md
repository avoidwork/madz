## 1. Create the config mutator module

- [ ] 1.1 Create `src/config/mutate.js` with exports `setConfigValueAt()`, `assignPath()`, and `parseValue()`
- [ ] 1.2 Implement `setConfigValueAt(config, dotPath, valueStr)` that clones config, parses value, assigns dot-path, validates with zod, applies to original, and persists via `saveConfig()`
- [ ] 1.3 Implement standalone `parseValue(str)` for boolean/number/string coercion
- [ ] 1.4 Implement standalone `assignPath(patched, dotPath, value)` for dot-path mutation with intermediate object creation

## 2. Update the config loader

- [ ] 2.1 Import `setConfigValueAt` from `mutate.js` in `src/config/loader.js` and re-export as `setConfigValue` for backward compatibility
- [ ] 2.2 Remove the duplicate `parseValue` and `assignPath` functions from `loader.js` (they are now in `mutate.js`)
- [ ] 2.3 Ensure `saveConfig()` in `loader.js` remains the single YAML serialization entry point

## 3. Write tests for the config mutator

- [ ] 3.1 Create `tests/unit/config/mutate.test.js` testing `parseValue()` (booleans, integers, floats, negatives, strings)
- [ ] 3.2 Create `tests/unit/config/mutate.test.js` testing `assignPath()` (nested values, intermediate objects, overwrites)
- [ ] 3.3 Create `tests/unit/config/mutate.test.js` testing `setConfigValueAt()` with mocked `saveConfig` and zod validation
- [ ] 3.4 Add test for zod rejection when mutation violates the schema (e.g., invalid type)
- [ ] 3.5 Add test that `setConfigValueAt` creates intermediate objects for deep paths
- [ ] 3.6 Update `tests/unit/config.test.js` to re-export tests from `mutate.test.js` where applicable (or remove duplicates)

## 4. Verify the change

- [ ] 4.1 Run `npm run lint` — no errors
- [ ] 4.2 Run `npm run test` — all tests pass
- [ ] 4.3 Run `npm run coverage` — generate `coverage.txt` with 100% coverage on new code
