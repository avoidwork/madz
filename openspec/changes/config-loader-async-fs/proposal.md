## Why

`src/config/loader.js` uses synchronous filesystem I/O (`readFileSync`, `writeFileSync`) inside functions that are called from async contexts. Per AGENTS.md §1.1, blocking operations inside async functions are forbidden. `loadConfig()` uses `readFileSync(CONFIG_PATH, "utf-8")` and `saveConfig()` uses `writeFileSync(CONFIG_PATH, yamlContent)`. Both are synchronous and block the event loop. The fix is to use async file I/O (`readFile`/`writeFile` from `node:fs/promises`).

## What Changes

- Convert `loadConfig()` in `src/config/loader.js` to an `async` function using `readFile` from `node:fs/promises`. Replace the `existsSync(CONFIG_PATH)` guard with a try/catch on `readFile` that treats `ENOENT` as "no config file" (skip the read).
- Convert `saveConfig()` in `src/config/loader.js` to an `async` function using `writeFile` from `node:fs/promises`. Replace `existsSync(dir)` + `mkdirSync(dir, { recursive: true })` with `mkdir(dir, { recursive: true })` (idempotent).
- Convert `setConfigValue()` to `async` (it calls `saveConfig()`), and update its caller in `src/tui/conversationArea.js` to `await setConfigValue(...)`.
- Update all callers of `loadConfig()` to `await` it. Module-level calls use top-level await (ESM, Node 24+).
- Preserve the module-level `cachedConfig` cache and add a cached promise so concurrent calls before the cache is populated do not double-read the file.
- No change to config schema, YAML format, env-var resolution, or validation pipeline.

## Capabilities

### New Capabilities
- `config-loader-async-fs`: The config loader uses async file I/O (`readFile`/`writeFile` from `node:fs/promises`) instead of synchronous I/O, eliminating event-loop blocking in async contexts.

### Modified Capabilities
- `async-fs`: The "Async fs operations in async contexts" requirement is extended to cover `loadConfig()` and `saveConfig()` in `src/config/loader.js`, which previously used `readFileSync`/`writeFileSync`.

## Impact

- **Modified**: `src/config/loader.js` — `loadConfig()`, `saveConfig()`, `setConfigValue()` become async; `readFileSync`/`writeFileSync`/`existsSync`/`mkdirSync` replaced with `readFile`/`writeFile`/`mkdir` from `node:fs/promises`.
- **Modified**: `src/tui/conversationArea.js` — `_setConfigValue` closure awaits `setConfigValue()`.
- **Modified**: All callers of `loadConfig()` across `src/` and `index.js` — updated to `await`.
- **Modified**: `tests/unit/tools/calendar.test.js` — updated to `await loadConfig()`.
- **Unchanged**: Config schema, YAML format, env-var resolution, validation pipeline.

## Non-goals

- No change to config schema, YAML serialization format, or comment preservation.
- No change to env-var resolution or validation pipeline.
- No change to the `config-mutator` tool or `src/config/mutate.js`.
- No change to the `logger.js` module-level sync fs (it is not called from async contexts during initialization).
