# Proposal

## Why

`config.cwd` is captured once inside `loadConfig()` as `process.cwd()` and cached in a module-level `cachedConfig`. Because ES module imports evaluate exactly once, any module that destructures `config.cwd` at the top level freezes that snapshot at import time — pinned to whatever directory the process happened to occupy when the first importer triggered `loadConfig()`. When the harness later switches the working directory into a coding project (`process.chdir` in `src/tui/app.js`), those modules keep operating against the wrong root. This is a correctness bug that silently misdirects file-system path resolution across memory, todo, skills discovery, and session subsystems.

## What Changes

- Add an explicit, validated cwd-injection API to the config layer: a `setConfig({ cwd })` function that normalizes the supplied cwd to an absolute, real, existing path and rejects any value that would escape the intended working directory.
- Make `loadConfig()` honor an explicitly-set cwd instead of silently overwriting it with `process.cwd()` on cached calls.
- Refactor the seven frozen modules — `src/tools/memory/index.js`, `src/tools/todo/index.js`, `src/skills/discoverer.js`, `src/session/checkpointer.js`, `src/session/factory.js`, `src/session/saver.js`, `src/session/loader.js` — so their effective `cwd` is derived from the live resolved config at call time (or pinned via the init hook) rather than a top-level constant, preserving all existing exported signatures and default-parameter behavior.
- Document that the five per-call default-parameter modules (`src/memory/tools.js`, `src/memory/expireEphemeralMemories.js`, `src/memory/screenshots.js`, `src/memory/contextDir.js`, `src/memory/retention.js`) re-evaluate `loadConfig().cwd` per call and require no change.
- Add a regression test at `tests/unit/config/cwd.test.js`.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `config-system`: Add a requirement that the working directory (`config.cwd`) can be explicitly pinned via a validated `setConfig()` call during init, that `loadConfig()` honors that value across cached calls, and that the value is normalized/validated so it cannot escape the intended working directory. Add a requirement that modules consuming `config.cwd` derive it from the live resolved config rather than freezing it at import time.

## Impact

- **Code:** `src/config/loader.js`, `src/config/config.js` (new `setConfig` + resolved-config getter); seven frozen modules listed above; new `tests/unit/config/cwd.test.js`.
- **APIs:** New public `setConfig({ cwd })` in the config layer; `src/skills/discoverer.js` retains its existing `cwd`/`setCwd()` exports.
- **Systems:** Path resolution for memory, todo, skills discovery, and session persistence now reflects the init-provided cwd rather than an import-time snapshot.
- **No breaking changes** to existing exported function signatures or default-parameter behavior.
