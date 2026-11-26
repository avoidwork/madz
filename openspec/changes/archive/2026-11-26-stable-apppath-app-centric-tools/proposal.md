# Proposal

## Why

App-centric tools (memory, todo, session, skills discovery, and their call-time consumers) resolve their on-disk file paths against `process.cwd()` at the moment each tool is generated. Because these tools are created and destroyed dynamically on demand, a tool generated after the user runs `/projects` and selects a project captures the project's working directory — so app files (memory entries, todos, session state, etc.) are written into the project directory instead of the stable application root. There is currently no stable "application root" in the config: `config.cwd` tracks the mutable `process.cwd()` and is intentionally moved by the TUI via `safeChdir()`.

## What Changes

- Add a dedicated, immutable `config.appPath` field to the config schema (`src/config/config.js`), next to the existing `cwd` field.
- Pin `config.appPath` **once** at bootstrap in `index.js`'s `doBootstrap()` (before any `safeChdir()`/`process.chdir()`), normalized to an absolute, existing directory. Nothing mutates `appPath` afterward.
- Switch the frozen/app-centric modules (`src/tools/memory/index.js`, `src/tools/todo/index.js`, `src/skills/discoverer.js`, `src/session/{checkpointer,factory,saver,loader}.js`) to resolve their default storage paths against `loadConfig().appPath`, preserving exported signatures and default-parameter behavior.
- Switch call-time app-file-writing consumers (`src/agent/deepAgents.js`, `src/memory/{writer,prompts}.js`, `src/tools/{clarify,sampling,cron,session}/index.js`, `src/tools/code/searchCode.js`, `src/tools/{browser,tts,pptx}/index.js`, `src/workspace/loadAgents.js`) to resolve app paths against `loadConfig().appPath`.
- Leave TUI display consumers (e.g. `safeChdir(config.cwd || process.cwd())` in `src/tui/app.js`) on `config.cwd`, which continues to track `process.cwd()`.
- Add a regression test at `tests/unit/config/appPath.test.js` proving app files resolve against the stable `appPath` even after a project switch.

## Capabilities

### New Capabilities
- `app-root-path`: The stable, immutable application root captured once at bootstrap and used by all app-file-writing tools to resolve storage paths, independent of any `process.chdir()` performed when the user switches projects.

### Modified Capabilities
- `config-system`: The config schema gains a top-level `appPath` field (string, default `""`), pinned once at bootstrap to the bootstrap-time working directory and never mutated afterward.
- `tui-project-cwd`: App-file-writing tools SHALL NOT follow the project working directory; they resolve against `config.appPath`. Only TUI display and process-cwd-moving behavior continues to track the selected project.

## Impact

- **Code:** `src/config/config.js` (schema), `index.js` (`doBootstrap`), the seven app-centric modules listed above, and the call-time consumers listed above.
- **Config:** New `appPath` field (defaults to `""`; populated at bootstrap). No `config.yaml` change required.
- **Tests:** New `tests/unit/config/appPath.test.js`; existing memory/todo/session/skills/config tests must continue to pass.
- **Dependencies:** None added.
- **Behavior:** App files (memory, todo, session, skills, context, screenshots, tts/pptx outputs, agent memory dirs) land in the stable app root regardless of `/projects` switching. Code-search index location is treated as app-scoped.

## Non-goals

- No runtime `setConfig()`/mutation API for `appPath` (this supersedes the more complex approach in #2103).
- `config.cwd` semantics are unchanged — it still tracks `process.cwd()` for the TUI's project-switching display.
- No change to how projects are discovered or listed.
