## Why

The config loader's `_resolveEnvRecursively()` only walks keys that already exist in the parsed YAML config tree. Environment variables that define config paths not yet present in `config.yaml` are silently ignored, making env vars a second-class config source that cannot define new structure — only override existing values. This means defining configuration purely through environment variables (e.g., in containers, CI, or .env files) is impossible without also editing `config.yaml`. The `syncEnv()` function makes env vars a first-class config source, enabling full configuration via environment without touching YAML files.

## What Changes

- Add `syncEnv()` function to `src/config/loader.js` that scans `process.env` for keys matching known config section prefixes and materializes missing config structure (objects, arrays) into the raw config object
- Build a schema-driven reverse mapping by introspecting `ConfigSchema` to enumerate valid config paths and generate their env-var names
- Add `applyDotPath()` helper to materialize intermediate objects/arrays from dot-paths
- Wire `syncEnv()` into `loadConfig()` between the YAML deepMerge and `_resolveEnvRecursively()`
- Fix dead `"subAgentsTemperature"` entry in DROPPED_KEYS to lowercase `"subagentstemperature"`
- Add unit tests for `syncEnv()` covering: env-only project materialization, prefix allowlist filtering, array index assembly, idempotency, and DROPPED_KEYS filtering
- Add integration test for `loadConfig()` with env vars defining a new vector project

## Capabilities

### New Capabilities
- `env-config-sync`: Environment variable config synchronization — scan `process.env` for known config paths and materialize missing structure into the config object before recursive env resolution

### Modified Capabilities
<!-- No existing specs to modify — this is a new capability -->

## Impact

- **src/config/loader.js**: Add `syncEnv()`, `buildReverseMap()`, `applyDotPath()`, fix DROPPED_KEYS, wire into `loadConfig()`
- **tests/unit/config/loader.test.js**: New unit tests for syncEnv functionality
- **No new dependencies**: All logic uses built-in Node.js and Zod (already a dependency)
- **No breaking changes**: syncEnv() is idempotent and only creates missing structure
