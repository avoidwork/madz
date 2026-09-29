## 1. Convert config loader to async file I/O

- [ ] 1.1 In `src/config/loader.js`, replace `import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"` with `import { readFile, writeFile, mkdir } from "node:fs/promises"`
- [ ] 1.2 Convert `loadConfig()` to `async`, replace `existsSync(CONFIG_PATH)` + `readFileSync(CONFIG_PATH, "utf-8")` with `try { const fileContent = await readFile(CONFIG_PATH, "utf-8"); ... } catch (err) { if (err.code !== "ENOENT") throw err; }`
- [ ] 1.3 Cache the in-flight promise in `loadConfig()` so concurrent calls before cache population do not double-read the file
- [ ] 1.4 Convert `saveConfig()` to `async`, replace `existsSync(dir)` + `mkdirSync(dir, { recursive: true })` with `await mkdir(dir, { recursive: true })`, and `writeFileSync(CONFIG_PATH, yamlContent)` with `await writeFile(CONFIG_PATH, yamlContent)`
- [ ] 1.5 Convert `setConfigValue()` to `async` and `await saveConfig(config)`

## 2. Update callers of loadConfig() to await

- [ ] 2.1 `index.js` — `const config = await loadConfig()` (top-level await)
- [ ] 2.2 `src/agent/contextBackend.js` — `await loadConfig()`
- [ ] 2.3 `src/agent/deepAgents.js` — `await loadConfig()`
- [ ] 2.4 `src/memory/context.js` — `await loadConfig()` for module-level `cwd` and in-function calls
- [ ] 2.5 `src/memory/expireEphemeralMemories.js` — `await loadConfig()` for module-level `cwd`
- [ ] 2.6 `src/memory/profile.js` — `await loadConfig()` for module-level `config`
- [ ] 2.7 `src/memory/prompts.js` — `await loadConfig()` for module-level `cwd`
- [ ] 2.8 `src/memory/retention.js` — `await loadConfig()` for module-level `cwd`
- [ ] 2.9 `src/memory/tools.js` — `await loadConfig()` for module-level `cwd`
- [ ] 2.10 `src/memory/writer.js` — `await loadConfig()` in `writeMemoryFile()`
- [ ] 2.11 `src/session/checkpointer.js` — `await loadConfig()` for module-level `cwd`
- [ ] 2.12 `src/session/factory.js` — `await loadConfig()` for module-level `cwd`
- [ ] 2.13 `src/session/loader.js` — `await loadConfig()` for module-level `cwd`
- [ ] 2.14 `src/session/saver.js` — `await loadConfig()` for module-level `cwd`
- [ ] 2.15 `src/skills/agentMapper.js` — `await loadConfig()` in `getAgentForSkill()`
- [ ] 2.16 `src/skills/discoverer.js` — `await loadConfig()` for module-level `defaultScope` and `cwd`
- [ ] 2.17 `src/skills/registry.js` — `await loadConfig()` for module-level `config`
- [ ] 2.18 `src/tools/calendar/providers/factory.js` — `await loadConfig()` in `getActiveCalendarProvider()`
- [ ] 2.19 `src/tools/code/indexCode.js` — `await loadConfig()` for module-level `config`
- [ ] 2.20 `src/tools/code/searchCode.js` — `await loadConfig()` for module-level `config`
- [ ] 2.21 `src/tools/config/index.js` — `await loadConfig()` in `getConfigImpl()`
- [ ] 2.22 `src/tools/cron/index.js` — `await loadConfig()` for module-level `config`
- [ ] 2.23 `src/tools/email/tools.js` — `await loadConfig()` for module-level `config`
- [ ] 2.24 `src/tools/image/index.js` — `await loadConfig()` in `imageImpl()`
- [ ] 2.25 `src/tools/image/readImage.js` — `await loadConfig()` in `readImageImpl()`
- [ ] 2.26 `src/tools/memory/index.js` — `await loadConfig()` for module-level `config`
- [ ] 2.27 `src/tools/sampling/index.js` — `await loadConfig()` for module-level `config` and in `samplingImpl()`
- [ ] 2.28 `src/tools/scanAgents/index.js` — `await loadConfig()` for module-level `cwd`
- [ ] 2.29 `src/tools/session/index.js` — `await loadConfig()` for module-level `config` and in `searchSessionImpl()`
- [ ] 2.30 `src/tools/skills/index.js` — `await loadConfig()` in `createSkillImpl()`
- [ ] 2.31 `src/tools/tts/index.js` — `await loadConfig()` in `ttsImpl()`
- [ ] 2.32 `src/tools/web/index.js` — `await loadConfig()` for module-level `config`

## 3. Update setConfigValue caller

- [ ] 3.1 `src/tui/conversationArea.js` — make `_setConfigValue` closure async and `await setConfigValue(config, dotPath, valueStr)`

## 4. Update tests

- [ ] 4.1 `tests/unit/tools/calendar.test.js` — `await loadConfig()` in "should load config with calendar defaults"
- [ ] 4.2 `tests/integration/syncEnv.test.js` — update `loadConfig()` integration test to `await`
- [ ] 4.3 Add `tests/unit/config/loader.test.js` covering async `loadConfig()` (reads file, handles ENOENT, caches in-flight promise) and async `saveConfig()` (writes file, creates dir)

## 5. Verify the change

- [ ] 5.1 `npm run lint` passes — no errors
- [ ] 5.2 `npm run test` — all tests pass
- [ ] 5.3 `npm run coverage` — generated `coverage.txt`
