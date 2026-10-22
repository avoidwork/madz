## Context

The tool layer has an established convention for file-producing tools: resolve the output directory from `config.memory.toolsDir` via `loadConfig()`. `screenshotWeb` uses `config.memory.screenshotsDir`, `cron`/`sampling`/`memory`/`webhook` use `config.memory.*` directories. Five tools diverge:

- `clarify` hardcodes `memory/context/clarifications.md` as its fallback, which pollutes the system prompt because `loadContext()` (`src/memory/context.js:20`) concatenates every `.md` in `memory/context/`.
- `generatePptx` requires `outputPath` (no default).
- `generatePdf` has optional `outputPath` but no default.
- `spreadsheet` has optional `outputPath` but no default.
- `tts` writes to `join(homedir(), "voice-memos")`, entirely outside the project tree.

`config.memory.toolsDir` already exists in the schema (`src/config/schemas/memory.js:15`, default `memory/tools/`) and in `config.yaml`.

## Goals / Non-Goals

**Goals:**
- Make all five tools resolve their output directory from `config.memory.toolsDir` via `loadConfig()`.
- Remove `clarifications.md` from the system-prompt concatenation by relocating it to `memory/tools/`.
- Add a `SYSTEM_PROMPT.md` fallback directive as a guardrail for future tools.
- Add regression tests asserting each tool defaults to `config.memory.toolsDir`.

**Non-Goals:**
- Changing the `config.memory.toolsDir` default value.
- Migrating existing `memory/context/clarifications.md` content.
- Altering the `validateOutputPath` traversal guard.
- Refactoring already-config-driven tools.

## Decisions

### 1. `clarify` reads config directly via `loadConfig()`
The registered `clarify` tool is a bare singleton in `buildToolConfig` (`src/tools/index.js:355`), so it never receives runtime `options`. It must call `loadConfig()` itself. The fallback becomes `config.memory.toolsDir` (default `memory/tools/`), and the file is `join(toolsDir, "clarifications.md")`. The `options.clarificationsFile` override is preserved for test injection. The tool description is updated to reference `memory/tools/`.

**Alternative considered:** Threading `toolsDir` through `buildToolConfig` runtime options. Rejected because `clarify` is registered as a bare singleton and would require restructuring the registration path — a larger change than the bug warrants.

### 2. `generatePptx` makes `outputPath` optional with a `toolsDir` default
`outputPath` becomes `z.string().optional()`. In `createPptx`, when omitted, it defaults to `join(config.memory.toolsDir, "presentation-<timestamp>.pptx")`. The `validateOutputPath` guard is preserved and applied to the resolved path.

**Alternative considered:** Requiring the caller to always pass `outputPath`. Rejected — the issue explicitly asks for a config-driven default.

### 3. `generatePdf` defaults `outputPath` to `toolsDir`
`outputPath` is already optional. When omitted, the action handlers default it to `join(config.memory.toolsDir, ...)`. The `savePdf` write path is unchanged.

### 4. `spreadsheet` defaults `outputPath` to `toolsDir`
`outputPath` is already optional. When omitted, `generate`/`modify`/`export` default it to `join(config.memory.toolsDir, ...)`.

### 5. `tts` writes to `config.memory.toolsDir`
Replace `join(homedir(), "voice-memos")` with `join(config.cwd, config.memory.toolsDir)`. The `homedir()` import is removed. The tool description is updated to reference `memory/tools/`.

### 6. `SYSTEM_PROMPT.md` fallback directive
Add a rule under the operating principles stating that tool outputs should be saved to `memory/tools/` when a tool does not handle the concern itself. This is a guardrail, not a substitute for the config-driven fix.

## Risks / Trade-offs

- **[Relocating `clarifications.md` changes system-prompt content]** → The clarification history is no longer concatenated into the prompt. This is the intended fix; the `memoryPanel` already filters `clarifications.md` out of the memory browser, so no TUI regression.
- **[`tts` output moves from `~/voice-memos` to `memory/tools/`]** → Existing `MEDIA:` paths in prior sessions become stale. Acceptable; the issue explicitly requests this change.
- **[Default filenames collide across calls]** → Timestamped filenames (`presentation-<ts>.pptx`, etc.) mitigate collisions.
- **[`loadConfig()` is cached]** → The tools read the cached config, consistent with `screenshotWeb`/`cron`/`sampling`.
