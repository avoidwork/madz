## Context

`src/config/loader.js` is the single source of configuration loading for the madz harness. It exports `loadConfig()`, `saveConfig()`, and `setConfigValue()`. Currently:

- `loadConfig()` uses `readFileSync(CONFIG_PATH, "utf-8")` and `existsSync(CONFIG_PATH)`.
- `saveConfig()` uses `writeFileSync(CONFIG_PATH, yamlContent)` and `mkdirSync(dir, { recursive: true })`.
- `setConfigValue()` calls `saveConfig()` synchronously.

Per AGENTS.md §1.1, blocking operations inside async functions are strictly prohibited. `loadConfig()` is called from async contexts across ~30 files (tools, agent orchestrator, memory, session, skills, TUI), and `saveConfig()` is called from the TUI config-mutation path. Both block the event loop.

The project already has an `async-fs` spec (archived from `replace-sync-fs-calls-and-silent-catches`) that mandates `node:fs/promises` for all fs operations in async contexts. This change brings the config loader into compliance.

## Goals / Non-Goals

**Goals:**
- Convert `loadConfig()`, `saveConfig()`, and `setConfigValue()` to async functions using `node:fs/promises`.
- Update all callers across `src/` and `index.js` to `await` the now-async functions.
- Preserve existing behavior: module-level `cachedConfig` cache, `_setResolvedConfig()` wiring, env-var resolution, and schema validation.
- Keep the change minimal and scoped to the config loader and its callers.

**Non-Goals:**
- No change to config schema, validation, or env-var resolution logic.
- No change to the `config.yaml` format or the `syncEnv`/`_resolveEnvRecursively` functions.
- No refactoring of unrelated code.

## Decisions

### Decision 1: Use `node:fs/promises` for all fs ops in the loader
Replace `readFileSync`/`existsSync` with `readFile`/`access` and `writeFileSync`/`mkdirSync` with `writeFile`/`mkdir` from `node:fs/promises`. This aligns with the existing `async-fs` spec and AGENTS.md §1.1.

- **Alternatives considered:** Keeping sync fs but wrapping in `Promise.resolve()` — rejected because it still blocks the event loop. Using `fs.promises` is the idiomatic Node.js approach.

### Decision 2: Make `loadConfig()` async and `await` it in callers
`loadConfig()` becomes `async`. Callers that previously did `const config = loadConfig()` must become `const config = await loadConfig()`. Callers at module top-level (e.g., `const cwd = loadConfig().cwd`) must be refactored to lazy-load or move into async functions.

- **Alternatives considered:** Keeping `loadConfig()` sync and only converting `saveConfig()` — rejected because the issue explicitly targets `loadConfig()`'s `readFileSync`, and AGENTS.md §1.1 forbids blocking fs in async contexts.

### Decision 3: Preserve the module-level cache
`cachedConfig` remains module-level. Since `loadConfig()` is now async, the cache check happens at the top of the async function. The cache is populated after the first successful load. This preserves the "subsequent calls return the same object" contract.

### Decision 4: Handle module-top-level callers
Several modules call `loadConfig()` at module top-level (e.g., `const cwd = loadConfig().cwd`). These cannot `await` at top level in a non-async module. The approach is to convert these to lazy accessors or move the call into the async functions that use them. Where a module exports a top-level constant derived from config (e.g., `defaultScope`), convert it to a getter or lazy function.

## Risks / Trade-offs

- **[Risk] Module-top-level callers break** → Mitigation: Convert top-level `loadConfig()` calls to lazy getters or move them into async functions. Audit every caller.
- **[Risk] `index.js` startup ordering** → Mitigation: `index.js` already uses top-level `await` for dynamic imports; convert `const config = loadConfig()` to `const config = await loadConfig()`.
- **[Risk] Tests importing modules that call `loadConfig()` at top level** → Mitigation: Update affected tests to `await` or mock the loader.
- **[Risk] `setConfigValue()` callers in TUI** → Mitigation: `setConfigValue()` becomes async; the TUI callback must `await` it or handle the promise.

## Migration Plan

1. Convert `loadConfig()`, `saveConfig()`, `setConfigValue()` in `src/config/loader.js` to async.
2. Update `index.js` to `await loadConfig()`.
3. Update all callers in `src/` to `await` the async functions.
4. Update affected tests.
5. Run `npm run lint`, `npm run test`, and `npm run coverage`.

## Open Questions

- None — the scope is well-defined by the issue and the existing `async-fs` spec.
