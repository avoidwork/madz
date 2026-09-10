## 1. Fix DROPPED_KEYS dead entry

- [ ] 1.1 Change `"subAgentsTemperature"` to `"subagentstemperature"` in the DROPPED_KEYS array in `src/config/loader.js`

## 2. Implement applyDotPath helper

- [ ] 2.1 Add `applyDotPath()` function to `src/config/loader.js` that takes a target object, dot-path, and value, and materializes intermediate objects/arrays (handles numeric segments for array indices)

## 3. Build schema-driven reverse mapping

- [ ] 3.1 Add `buildReverseMap()` function to `src/config/loader.js` that introspects `ConfigSchema` to enumerate all valid config paths and generate their env-var names, returning a Map of env-var-name → dot-path

## 4. Implement syncEnv function

- [ ] 4.1 Add `syncEnv()` function to `src/config/loader.js` that scans `process.env` for keys matching known config section prefixes, uses the reverse map to resolve dot-paths, and calls `applyDotPath()` to materialize missing structure
- [ ] 4.2 Wire `syncEnv()` into `loadConfig()` between the YAML deepMerge (line 161) and `_resolveEnvRecursively()` (line 164)

## 5. Write unit tests

- [ ] 5.1 Create `tests/unit/config/loader.test.js` with tests for: env-only project materialization, prefix allowlist filtering, array index assembly, idempotency when YAML already has keys, and DROPPED_KEYS filtering
- [ ] 5.2 Add integration test: set env vars defining a new vector project (with dummy names), call `loadConfig()`, verify the project appears in the resolved config

## 6. Verify

- [ ] 6.1 Run `npm run test` and confirm all tests pass
- [ ] 6.2 Run `npm run lint` and confirm no lint errors
