# Tasks

## 1. Config layer: validated cwd injection

- [ ] 1.1 Add `setConfig({ cwd })` to `src/config/loader.js` that normalizes the input to an absolute, real, existing directory (via `path.resolve` + `fs.realpathSync` + existence/dir check), rejects non-existent/non-directory/escaping paths with a clear error, writes the result into the cached config `cwd`, and re-runs `_setResolvedConfig` — verify by a unit test that a valid temp dir pins `loadConfig().cwd` to the normalized path
- [ ] 1.2 Gate the `config.cwd = process.cwd()` assignment in `loadConfig()` behind a module-level "explicitly set" flag so an explicitly-set cwd survives cached `loadConfig()` calls and is not overwritten — verify by a test asserting `loadConfig().cwd` keeps the pinned value after a subsequent cached `loadConfig()`
- [ ] 1.3 Implement root-containment validation so a cwd resolving outside the intended working-directory root throws and leaves `config.cwd` unchanged — verify by a test that an escaping/relative-out-of-root/non-existent cwd is rejected

## 2. Unfreeze the seven frozen modules

- [ ] 2.1 Replace the top-level frozen `cwd` snapshot in `src/tools/memory/index.js` with a call-time accessor reading the live resolved config, preserving the `resolveContextDir(contextDir, cwdParam = cwd)` default — verify by importing the module, `process.chdir()`-ing away, and asserting its effective cwd still equals the init-provided value
- [ ] 2.2 Apply the same lazy-cwd fix to `src/tools/todo/index.js` and `src/skills/discoverer.js`, keeping `discoverer.js`'s exported `cwd`/`setCwd()` API intact while re-deriving the frozen `defaultScope`/`cwd` defaults from the resolved config — verify by a test that todo and discoverer resolve paths against the pinned cwd after chdir
- [ ] 2.3 Apply the same lazy-cwd fix to `src/session/checkpointer.js`, `src/session/factory.js`, `src/session/saver.js`, and `src/session/loader.js`, preserving every exported function signature and default-parameter behavior — verify by a test that session modules resolve against the pinned cwd after chdir

## 3. Review per-call default-param modules

- [ ] 3.1 Confirm `src/memory/tools.js`, `src/memory/expireEphemeralMemories.js`, `src/memory/screenshots.js`, `src/memory/contextDir.js`, and `src/memory/retention.js` re-evaluate `loadConfig().cwd` per call (not frozen at import) and require no change — verify by grep/inspection documented in the PR and by confirming existing memory tests still pass

## 4. Regression test and verification

- [ ] 4.1 Create `tests/unit/config/cwd.test.js` covering: `setConfig({ cwd })` pins `loadConfig().cwd`; a caching module reports the init-provided cwd after `process.chdir()`; and an out-of-bounds/non-existent cwd is rejected — verify the new test passes and fails against pre-fix code
- [ ] 4.2 Run `npm run test` and `npm run coverage` and confirm all tests pass with no regressions — verify `coverage.txt` reports the new file with coverage and the suite is green
- [ ] 4.3 Run `npm run lint` to confirm the changed files meet oxlint/oxfmt conventions — verify lint exits clean

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
