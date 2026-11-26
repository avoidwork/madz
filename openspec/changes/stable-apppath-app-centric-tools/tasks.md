# Tasks

## 1. Config schema and bootstrap pinning

- [ ] 1.1 Add `appPath: z.string().default("")` next to the `cwd` field in `src/config/config.js` and verify the schema parses with an `appPath` key (run `node -e "import('./src/config/config.js').then(m=>console.log(typeof m.ConfigSchema))"`).
- [ ] 1.2 In `index.js` `doBootstrap()`, immediately after `config = loadConfig()`, pin `config.appPath` to the bootstrap-time cwd normalized via `path.resolve()` and confirmed to be an existing directory (fall back to `""` if unresolvable), then verify `config.appPath` is set and nothing after it mutates it.
- [ ] 1.3 Verify `config.cwd` still tracks `process.cwd()` (unchanged) by confirming `loadConfig().cwd` reflects the live cwd after a `process.chdir()` while `loadConfig().appPath` does not.

## 2. Switch app-centric modules to `loadConfig().appPath`

- [ ] 2.1 Switch `src/tools/memory/index.js` default `cwdParam` from `config.cwd` to `loadConfig().appPath` (preserving the `resolveContextDir`/`getEntryPath`/`saveEntry` signatures) and verify the memory module resolves entries under appPath.
- [ ] 2.2 Switch `src/tools/todo/index.js` (`const cwd = config.cwd` → `loadConfig().appPath`) and verify `join(cwd, config.memory.toolsDir, "todo.json")` resolves under appPath.
- [ ] 2.3 Switch `src/skills/discoverer.js` (`export let cwd = loadConfig().cwd` → `loadConfig().appPath`) preserving the `setCwd`/`cwdParam` override behavior and verify discovery resolves scope under appPath.
- [ ] 2.4 Switch `src/session/{checkpointer,factory,saver,loader}.js` default `cwd` from `loadConfig().cwd` to `loadConfig().appPath`, preserving `cwdParam` defaults, and verify each `ensure*Dir`/`saveSession`/`loadSession` resolves under appPath.

## 3. Switch call-time app-path consumers

- [ ] 3.1 Switch `src/agent/deepAgents.js` memoryDir/sessionsDir/contextDir (lines ~378, 430, 431) to `loadConfig().appPath` and verify deep-agent memory/session dirs resolve under appPath.
- [ ] 3.2 Switch `src/memory/writer.js` (line 53) and `src/memory/prompts.js` (line 77) to `loadConfig().appPath` and verify memory writes/prompts resolve under appPath.
- [ ] 3.3 Switch `src/tools/clarify/index.js` (line 47), `src/tools/sampling/index.js` (lines 45, 63, 78), `src/tools/cron/index.js` (lines 150, 163), and `src/tools/session/index.js` (line 38) to `loadConfig().appPath` and verify each resolves under appPath.
- [ ] 3.4 Switch `src/tools/code/searchCode.js` (line 86), `src/tools/browser/index.js` (line 310), `src/tools/tts/index.js` (line 144), `src/tools/pptx/index.js` (line 512 and the `alloweddir || process.cwd()` default at line 194), and `src/workspace/loadAgents.js` (line 4) to `loadConfig().appPath` and verify each resolves under appPath.
- [ ] 3.5 Confirm TUI display consumers (e.g. `safeChdir(config.cwd || process.cwd())` in `src/tui/app.js`) remain on `config.cwd` and are not switched.

## 4. Regression test

- [ ] 4.1 Create `tests/unit/config/appPath.test.js` that sets `config.appPath` at bootstrap, `process.chdir()`-s into a temp project directory, resolves an app path via an app-centric module (memory), and asserts it lands under the stable `appPath` not the project cwd; restore cwd in `afterEach` and verify the new test passes with `node --test tests/unit/config/appPath.test.js`.
- [ ] 4.2 Verify the test genuinely guards the behavior by confirming it fails when `appPath` resolution is reverted to `config.cwd` (temporary check, then restore).

## 5. Verification

- [ ] 5.1 Run `npm run lint` and verify it passes (oxlint + oxfmt).
- [ ] 5.2 Run `npm run test` and verify all tests pass, including the new appPath test and existing memory/todo/session/skills/config tests.
- [ ] 5.3 Run `npm run coverage` and verify coverage is maintained.
- [ ] 5.4 Run `npm start` with a timeout and verify the app boots without crashing.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
