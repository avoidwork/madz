## Context

`src/config/loader.js` is the single source of truth for loading and saving the harness configuration. It reads `config.yaml` via `readFileSync` and writes it via `writeFileSync`. Both are synchronous and block the event loop. Per AGENTS.md §1.1, blocking operations inside async functions are forbidden. The existing `async-fs` spec already requires `node:fs/promises` for all fs operations in async contexts, but `loadConfig()` and `saveConfig()` were left as synchronous exceptions.

`loadConfig()` is called from module-level initialization in ~30 files across `src/` and `index.js`, and from async functions in tools, memory, session, and skills modules. `saveConfig()` is called by `setConfigValue()`, which is invoked from the TUI command handler.

The project is ESM (`"type": "module"`) on Node 24+, so top-level await is available for module-level `loadConfig()` calls.

## Goals / Non-Goals

**Goals:**
- Convert `loadConfig()` to async using `readFile` from `node:fs/promises`.
- Convert `saveConfig()` to async using `writeFile` from `node:fs/promises`.
- Convert `setConfigValue()` to async and update its caller.
- Update all callers of `loadConfig()` to `await` it.
- Preserve the module-level cache and avoid concurrent double-reads.

**Non-Goals:**
- No change to config schema, YAML format, env-var resolution, or validation pipeline.
- No change to the `config-mutator` tool or `src/config/mutate.js`.
- No change to `logger.js` module-level sync fs (not called from async contexts during initialization).

## Decisions

### Decision 1: Use `readFile` with try/catch instead of `existsSync` + `readFileSync`
**Choice**: Replace `existsSync(CONFIG_PATH)` + `readFileSync(CONFIG_PATH, "utf-8")` with a single `readFile(CONFIG_PATH, "utf-8")` wrapped in try/catch. On `ENOENT`, skip the file read (treat as no config file).
**Rationale**: `existsSync` is itself a blocking call. A try/catch on `readFile` handles the "file missing" case without a separate sync existence check. This removes both blocking calls.
**Alternatives**: Keep `existsSync` and only convert `readFileSync`. Rejected — `existsSync` is also blocking and violates AGENTS.md §1.1.

### Decision 2: Use a cached promise for `loadConfig()`
**Choice**: Keep the module-level `cachedConfig` object cache, but also cache the in-flight promise so concurrent calls before the cache is populated do not double-read the file.
**Rationale**: `loadConfig()` is called at module load in many files. Without a promise cache, concurrent module-level top-level awaits could trigger multiple file reads. A cached promise ensures a single read.
**Alternatives**: Rely on the existing `cachedConfig` check. Rejected — the check happens after the async read, so concurrent calls would all read the file before any sets the cache.

### Decision 3: Use `mkdir(dir, { recursive: true })` instead of `existsSync` + `mkdirSync`
**Choice**: Replace `existsSync(dir)` + `mkdirSync(dir, { recursive: true })` with `mkdir(dir, { recursive: true })`.
**Rationale**: `mkdir` with `{ recursive: true }` is idempotent and does not throw if the directory already exists. This removes the blocking `existsSync` call.
**Alternatives**: Keep `existsSync` + `mkdirSync`. Rejected — `existsSync` is blocking.

### Decision 4: Use top-level await for module-level `loadConfig()` calls
**Choice**: Module-level `const config = loadConfig()` becomes `const config = await loadConfig()`.
**Rationale**: The project is ESM on Node 24+, so top-level await is supported. This keeps the module-level initialization pattern intact.
**Alternatives**: Lazy-load config inside functions. Rejected — would require restructuring many modules and change module-level constants like `cwd`.

## Risks / Trade-offs

### Risk: Large blast radius (~30 call sites)
Making `loadConfig()` async touches many files. → Mitigation: The change is mechanical (add `await`). Tests and lint will catch any missed call site.

### Risk: Concurrent `loadConfig()` calls double-read the file
Without a promise cache, concurrent module-level awaits could read the file multiple times. → Mitigation: Cache the in-flight promise.

### Risk: Top-level await breaks if a module is imported in a non-ESM context
→ Mitigation: The project is `"type": "module"` and Node 24+, so top-level await is valid. No CommonJS consumers.

### Risk: `setConfigValue()` caller in TUI is not awaited
The `_setConfigValue` closure in `src/tui/conversationArea.js` calls `setConfigValue()` synchronously. → Mitigation: Update the closure to `await setConfigValue(...)`.
