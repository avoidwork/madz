## Why

Five file-producing tools (`clarify`, `generatePptx`, `generatePdf`, `spreadsheet`, `tts`) hardcode their output locations instead of reading `config.memory.toolsDir` via `loadConfig()`. This diverges from the established pattern used by `screenshotWeb`, `cron`, `sampling`, `memory`, and `webhook`, and `tts` writes entirely outside the project tree to `~/voice-memos`. The `clarify` tool also writes `clarifications.md` into `memory/context/`, which `loadContext()` then concatenates into the system prompt — polluting the prompt with clarification history.

## What Changes

- **`clarify`** — Read `config.memory.toolsDir` (default `memory/tools/`) via `loadConfig()` instead of the hardcoded `memory/context/clarifications.md` fallback. Update the tool description to reference `memory/tools/`. Because the registered `clarify` tool is a bare singleton in `buildToolConfig`, it never receives runtime options and must read config directly.
- **`generatePptx`** — Make `outputPath` optional in the schema and default it to `join(config.memory.toolsDir, ...)` when omitted. Preserve the `validateOutputPath` traversal guard.
- **`generatePdf`** — Default `outputPath` to `config.memory.toolsDir` when omitted (it is already optional but has no default).
- **`spreadsheet`** — Default `outputPath` to `config.memory.toolsDir` when omitted (it is already optional but has no default).
- **`tts`** — Replace the hardcoded `join(homedir(), "voice-memos")` with `config.memory.toolsDir`.
- **`SYSTEM_PROMPT.md`** — Add a fallback directive stating that tool outputs should be saved to `memory/tools/` when a tool does not handle the concern itself.
- **`loadContext()`** — Moving `clarifications.md` out of `memory/context/` removes it from the system prompt concatenation.

## Capabilities

### New Capabilities
- `config-driven-tool-outputs`: File-producing tools resolve their output directory from `config.memory.toolsDir` via `loadConfig()`, defaulting to `memory/tools/`, with a system-prompt guardrail directing future tools to the same location.

### Modified Capabilities
- `clarify-tool`: The `clarify` tool writes `clarifications.md` to `config.memory.toolsDir` (default `memory/tools/`) rather than `memory/context/`, and its description references the new location.
- `system-prompt`: `SYSTEM_PROMPT.md` gains a fallback directive instructing tools to save outputs to `memory/tools/` when they do not handle the concern themselves.

## Impact

- `src/tools/clarify/index.js` — config-driven fallback + description update.
- `src/tools/pptx/index.js` — optional `outputPath` with `config.memory.toolsDir` default.
- `src/tools/pdf/index.js` — `outputPath` defaults to `config.memory.toolsDir`.
- `src/tools/spreadsheet/spreadsheet.js` — `outputPath` defaults to `config.memory.toolsDir`.
- `src/tools/tts/index.js` — config-driven output directory.
- `prompts/SYSTEM_PROMPT.md` — fallback directive.
- `tests/unit/tools_clarify.test.js` — adjust assertions for the new path.
- New regression tests asserting each tool defaults to `config.memory.toolsDir` and that `loadContext()` no longer includes `clarifications.md`.

## Non-goals

- Not changing the `config.memory.toolsDir` default value itself (remains `memory/tools/`).
- Not migrating existing `memory/context/clarifications.md` content.
- Not altering the `validateOutputPath` traversal guard behavior.
- Not changing the `screenshotWeb`/`cron`/`sampling`/`memory`/`webhook` tools (already config-driven).
