CHANGE_NAME: async-config-loader

# Async Config Loader

## Summary

The config loader (`src/config/loader.js`) currently uses synchronous filesystem I/O (`readFileSync`, `writeFileSync`, `existsSync`, `mkdirSync`) inside `loadConfig()` and `saveConfig()`. Per AGENTS.md §1.1, blocking operations inside async functions are strictly prohibited. This change converts config loading and saving to async file I/O using `node:fs/promises` (`readFile`, `writeFile`, `access`, `mkdir`), and updates every caller across the codebase to `await` the now-async functions.

## Technical Approach

### `loadConfig()` → async

`loadConfig()` currently does:
```js
let raw = ConfigSchema.parse({});
if (existsSync(CONFIG_PATH)) {
    const fileContent = readFileSync(CONFIG_PATH, "utf-8");
    ...
}
```

This becomes:
```js
export async function loadConfig() {
    if (cachedConfig) return cachedConfig;
    let raw = ConfigSchema.parse({});
    try {
        await access(CONFIG_PATH);
        const fileContent = await readFile(CONFIG_PATH, "utf-8");
        ...
    } catch (err) {
        // CONFIG_PATH missing — fall through to env-only materialization
    }
    ...
}
```

The module-level `cachedConfig` cache and `_setResolvedConfig(config)` behavior are preserved. The function becomes `async` and returns a Promise.

### `saveConfig()` → async

`saveConfig()` currently does:
```js
export function saveConfig(config) {
    const dir = dirname(CONFIG_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const yamlContent = dump(config);
    writeFileSync(CONFIG_PATH, yamlContent);
}
```

This becomes:
```js
export async function saveConfig(config) {
    const dir = dirname(CONFIG_PATH);
    await mkdir(dir, { recursive: true });
    const yamlContent = dump(config);
    await writeFile(CONFIG_PATH, yamlContent);
}
```

`setConfigValue()` (which calls `saveConfig()`) becomes async and awaits `saveConfig()`.

### Caller updates

The bulk of the work is updating ~30 callers across `src/` and `index.js`. There are two patterns:

1. **Function-level calls** (e.g., `const config = loadConfig()` inside an async function): simply add `await`.
2. **Module-level calls** (e.g., `const cwd = loadConfig().cwd` at the top of a module): these run at import time. Since the project uses ESM (`"type": "module"`), top-level `await` is available. However, many of these modules export values derived from `loadConfig()` (e.g., `defaultScope`, `cwd`). For these, the cleanest approach is to keep the module-level value but compute it lazily inside functions, or convert the module-level const to a getter/function that awaits.

Key entry point: `index.js` line 26 does `const config = loadConfig()`. This becomes `const config = await loadConfig()` (top-level await in ESM).

### Architectural decisions

- **Preserve the cache:** `loadConfig()` keeps its module-level `cachedConfig` so repeated calls don't re-read the file. The cache is set synchronously after the first successful async load.
- **`access` vs `existsSync`:** Use `access(CONFIG_PATH)` from `node:fs/promises` to check existence without blocking. Wrap in try/catch since `access` throws on missing files.
- **No behavior change:** The config parsing, env-var resolution, validation, and `_setResolvedConfig` logic are unchanged. Only the I/O mechanism changes from sync to async.

## Files to modify

- `src/config/loader.js` — core change (async `loadConfig`, `saveConfig`, `setConfigValue`)
- `index.js` — await `loadConfig()`
- `src/tools/config/index.js` — await `loadConfig()`
- `src/tui/conversationArea.js` — async `_setConfigValue` callback
- `src/agent/contextBackend.js`, `src/agent/deepAgents.js` — await `loadConfig()`
- `src/memory/context.js`, `src/memory/expireEphemeralMemories.js`, `src/memory/profile.js`, `src/memory/prompts.js`, `src/memory/retention.js`, `src/memory/tools.js`, `src/memory/writer.js` — await `loadConfig()`
- `src/session/checkpointer.js`, `src/session/factory.js`, `src/session/loader.js`, `src/session/saver.js` — await `loadConfig()`
- `src/skills/agentMapper.js`, `src/skills/discoverer.js`, `src/skills/registry.js` — await `loadConfig()`
- `src/tools/calendar/providers/factory.js`, `src/tools/code/indexCode.js`, `src/tools/code/searchCode.js`, `src/tools/cron/index.js`, `src/tools/email/tools.js`, `src/tools/image/index.js`, `src/tools/image/readImage.js`, `src/tools/memory/index.js`, `src/tools/sampling/index.js`, `src/tools/scanAgents/index.js`, `src/tools/session/index.js`, `src/tools/skills/index.js`, `src/tools/tts/index.js`, `src/tools/web/index.js` — await `loadConfig()`

## Non-goals

- No change to config schema, validation, or env-var resolution logic.
- No change to the `config.yaml` format.
- No change to the `syncEnv`/`_resolveEnvRecursively` functions (they are pure and don't do I/O).
- No refactoring of unrelated code.

## Risks / Edge Cases

- **Module-level `loadConfig()` calls:** The trickiest part. Modules like `src/memory/context.js` do `const cwd = loadConfig().cwd` at import time. These must be converted to lazy accessors or moved into async functions. If a module exports a value derived from `loadConfig()` (e.g., `defaultScope`), it needs a getter or must be computed inside functions.
- **Top-level await in ESM:** `index.js` and any module using top-level `await` must be ESM (they are, since `"type": "module"`). Top-level await is supported in Node 24+.
- **Test impact:** Tests that import modules calling `loadConfig()` at module top-level may break. The `getConfig` tool test imports `src/tools/config/index.js` which calls `loadConfig()` — must be awaited.
