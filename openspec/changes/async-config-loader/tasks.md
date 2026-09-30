## 1. Convert config loader to async

- [ ] 1.1 Convert `loadConfig()` in `src/config/loader.js` to async, using `readFile` and `access` from `node:fs/promises` instead of `readFileSync` and `existsSync`
- [ ] 1.2 Convert `saveConfig()` in `src/config/loader.js` to async, using `writeFile` and `mkdir` from `node:fs/promises` instead of `writeFileSync` and `mkdirSync`
- [ ] 1.3 Convert `setConfigValue()` in `src/config/loader.js` to async and `await` `saveConfig()` within it

## 2. Update entry point

- [ ] 2.1 Update `index.js` to `await loadConfig()` at startup

## 3. Update callers in src/

- [ ] 3.1 Update `src/agent/contextBackend.js` to `await loadConfig()`
- [ ] 3.2 Update `src/agent/deepAgents.js` to `await loadConfig()`
- [ ] 3.3 Update `src/memory/context.js` to `await loadConfig()` (module-level `cwd` and in-function calls)
- [ ] 3.4 Update `src/memory/expireEphemeralMemories.js` to `await loadConfig()`
- [ ] 3.5 Update `src/memory/profile.js` to `await loadConfig()`
- [ ] 3.6 Update `src/memory/prompts.js` to `await loadConfig()`
- [ ] 3.7 Update `src/memory/retention.js` to `await loadConfig()`
- [ ] 3.8 Update `src/memory/tools.js` to `await loadConfig()`
- [ ] 3.9 Update `src/memory/writer.js` to `await loadConfig()`
- [ ] 3.10 Update `src/session/checkpointer.js` to `await loadConfig()`
- [ ] 3.11 Update `src/session/factory.js` to `await loadConfig()`
- [ ] 3.12 Update `src/session/loader.js` to `await loadConfig()`
- [ ] 3.13 Update `src/session/saver.js` to `await loadConfig()`
- [ ] 3.14 Update `src/skills/agentMapper.js` to `await loadConfig()`
- [ ] 3.15 Update `src/skills/discoverer.js` to `await loadConfig()`
- [ ] 3.16 Update `src/skills/registry.js` to `await loadConfig()`
- [ ] 3.17 Update `src/tools/calendar/providers/factory.js` to `await loadConfig()`
- [ ] 3.18 Update `src/tools/code/indexCode.js` to `await loadConfig()`
- [ ] 3.19 Update `src/tools/code/searchCode.js` to `await loadConfig()`
- [ ] 3.20 Update `src/tools/config/index.js` to `await loadConfig()`
- [ ] 3.21 Update `src/tools/cron/index.js` to `await loadConfig()`
- [ ] 3.22 Update `src/tools/email/tools.js` to `await loadConfig()`
- [ ] 3.23 Update `src/tools/image/index.js` to `await loadConfig()`
- [ ] 3.24 Update `src/tools/image/readImage.js` to `await loadConfig()`
- [ ] 3.25 Update `src/tools/memory/index.js` to `await loadConfig()`
- [ ] 3.26 Update `src/tools/sampling/index.js` to `await loadConfig()`
- [ ] 3.27 Update `src/tools/scanAgents/index.js` to `await loadConfig()`
- [ ] 3.28 Update `src/tools/session/index.js` to `await loadConfig()`
- [ ] 3.29 Update `src/tools/skills/index.js` to `await loadConfig()`
- [ ] 3.30 Update `src/tools/tts/index.js` to `await loadConfig()`
- [ ] 3.31 Update `src/tools/web/index.js` to `await loadConfig()`

## 4. Update TUI config mutation path

- [ ] 4.1 Update `src/tui/conversationArea.js` to `await setConfigValue()`

## 5. Update tests

- [ ] 5.1 Update `tests/unit/tools/getConfig.test.js` to handle async `loadConfig()`
- [ ] 5.2 Update any other tests that import modules calling `loadConfig()` at top level

## 6. Verify

- [ ] 6.1 Run `npm run lint`
- [ ] 6.2 Run `npm run test`
- [ ] 6.3 Run `npm run coverage`
