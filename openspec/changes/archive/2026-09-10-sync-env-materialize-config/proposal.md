## Why

The config loader's `_resolveEnvRecursively()` only walks keys that already exist in the parsed YAML config tree. Environment variables that define config paths not yet present in `config.yaml` are silently ignored, making env vars a second-class config source that cannot define new structure — only override existing values. This prevents full configuration via environment variables in containers, CI, or `.env` files without also editing `config.yaml`.

## What Changes

- Add `syncEnv()` function to `src/config/loader.js` that scans `process.env` for keys matching known config section prefixes and materializes missing structure (objects, arrays) into the raw config object
- Add `applyDotPath()` helper for materializing intermediate objects/arrays from dot-path segments
- Build a schema-driven reverse mapping from Zod schemas to resolve kebab-case/camelCase ambiguity when mapping env-var segments back to config path segments
- Wire `syncEnv()` into `loadConfig()` between the YAML deepMerge and `_resolveEnvRecursively()`
- Add unit tests and an integration test for the new functionality

## Capabilities

### New Capabilities
- `env-config-materialization`: Environment variables can define new config paths not present in `config.yaml`, making env vars a first-class config source alongside YAML

### Modified Capabilities
- `config-system`: The config loading pipeline gains a new step (`syncEnv`) between YAML parsing and env-var resolution, enabling env-var-driven structure creation
- `config-mutator`: The `applyDotPath` helper extends the existing dot-path mutation pattern used by the config mutator

## Impact

- `src/config/loader.js` — new `syncEnv()` and `applyDotPath()` functions, modified `loadConfig()`
- `src/config/config.js` — `ConfigSchema` used for prefix allowlist and schema introspection
- `src/config/schemas/vector.js` — `VectorProjectSchema` used for reverse mapping
- `tests/unit/config_loader.test.js` — new unit tests
- `tests/integration/` — new integration test
- No new npm dependencies
