## Why

`src/config/loader.js` uses synchronous filesystem I/O (`readFileSync`, `writeFileSync`, `existsSync`, `mkdirSync`) inside `loadConfig()` and `saveConfig()`. Per AGENTS.md §1.1, blocking operations inside async functions are strictly prohibited. `loadConfig()` is called from async contexts throughout the codebase (tools, agent orchestrator, memory, session, skills), and `saveConfig()` is called from the TUI config-mutation path. Both block the event loop, degrading concurrency and violating the project's async rules.

## What Changes

- Convert `loadConfig()` to `async`, using `readFile` and `access` from `node:fs/promises` instead of `readFileSync`/`existsSync`.
- Convert `saveConfig()` to `async`, using `writeFile` and `mkdir` from `node:fs/promises` instead of `writeFileSync`/`mkdirSync`.
- Convert `setConfigValue()` to `async` and `await` `saveConfig()`.
- Update every caller of `loadConfig()`/`saveConfig()`/`setConfigValue()` across `src/` and `index.js` to `await` the now-async functions.
- Preserve the module-level `cachedConfig` cache and `_setResolvedConfig()` behavior.

## Capabilities

### New Capabilities
- `async-config-loader`: The config loader (`src/config/loader.js`) SHALL use async file I/O (`readFile`/`writeFile`/`access`/`mkdir` from `node:fs/promises`) for all filesystem operations in `loadConfig()`, `saveConfig()`, and `setConfigValue()`, and SHALL NOT use synchronous fs operations in these async functions.

### Modified Capabilities
- `config-system`: The "Configuration Loading and Validation" requirement changes — `loadConfig()` becomes async and callers must `await` it.
- `getconfig-tool`: The `getConfig` tool calls `loadConfig()`; it must `await` the now-async function.

## Impact

- **Core:** `src/config/loader.js` — `loadConfig()`, `saveConfig()`, `setConfigValue()` become async.
- **Entry point:** `index.js` — `const config = loadConfig()` becomes `const config = await loadConfig()`.
- **Callers (~30 files):** `src/agent/`, `src/memory/`, `src/session/`, `src/skills/`, `src/tools/`, `src/tui/` — all `loadConfig()`/`saveConfig()`/`setConfigValue()` calls updated to `await`.
- **Tests:** `tests/unit/tools/getConfig.test.js` and `tests/integration/syncEnv.test.js` may need updates if they import modules that call `loadConfig()` at module top-level.
- **No change** to config schema, validation, env-var resolution, or `config.yaml` format.

## Non-goals

- No change to config schema, validation, or env-var resolution logic.
- No change to the `config.yaml` format or the `syncEnv`/`_resolveEnvRecursively` functions.
- No refactoring of unrelated code.
