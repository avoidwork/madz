## 1. Schema-Driven Reverse Mapping

- [x] 1.1 Implement `buildReverseMap()` that introspects `ConfigSchema` (and child schemas) to enumerate all valid config paths and generate their env-var names, producing a `Map<string, string>` from env-var name to dot-path
- [x] 1.2 Handle camelCase → UPPER_SNAKE_CASE conversion for env-var name generation, and reverse mapping back to original case
- [x] 1.3 Handle kebab-case segments (e.g., `base-url`) in the reverse mapping
- [x] 1.4 Account for DROPPED_KEYS containers implicitly via schema introspection (the schema already encodes the full path including containers like `providers`, `credentials`)

## 2. applyDotPath Helper

- [x] 2.1 Implement `applyDotPath(obj, dotPath, value)` that materializes intermediate objects for non-numeric segments
- [x] 2.2 Handle numeric segments by creating/extending arrays, filling gaps with `null`
- [x] 2.3 Export `applyDotPath` from `src/config/loader.js` (or keep as internal helper)

## 3. syncEnv() Implementation

- [x] 3.1 Implement `syncEnv(raw, knownSections)` that scans `process.env` for keys matching known config section prefixes
- [x] 3.2 For each matching env var, use the reverse map to find the config dot-path, then call `applyDotPath()` to materialize missing structure
- [x] 3.3 Ensure idempotency — only create missing structure, never override existing YAML keys
- [x] 3.4 Handle array materialization from env vars with numeric suffixes (e.g., `VECTOR_PROJECTS_MYPROJECT_INCLUDE_0` through `_13`)
- [x] 3.5 Wire `syncEnv()` into `loadConfig()` between the YAML deepMerge (line 161) and `_resolveEnvRecursively()` (line 164)

## 4. Unit Tests

- [x] 4.1 Write tests for `buildReverseMap()` — verify env-var name generation and reverse lookup
- [x] 4.2 Write tests for `applyDotPath()` — object creation, array creation, gap filling
- [x] 4.3 Write tests for `syncEnv()` — env-only project materialization, prefix allowlist filtering, array index assembly, idempotency when YAML already has keys
- [x] 4.4 Write tests for DROPPED_KEYS filtering via schema reverse mapping (e.g., `SANDBOX_SECONDS` → `sandbox.timeout.seconds`)

## 5. Integration Test

- [x] 5.1 Write integration test that sets env vars defining a new vector project, calls `loadConfig()`, and verifies the project appears in the resolved config with all fields populated

## 6. Verification

- [x] 6.1 Run `npm run test` and fix any failures
- [x] 6.2 Run `npm run lint` and fix any issues
- [x] 6.3 Run `npm run coverage` and confirm coverage is maintained
