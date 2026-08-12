## Why

The reflection skill currently uses brittle shell commands (`find` + `grep`) to discover and filter session files. This approach is error-prone with YAML frontmatter, untestable, and lacks configurable ignore patterns. A proper Node.js tool would handle filtering cleanly, make ignore patterns configurable, and keep the skill focused on narrative generation.

## What Changes

- **New tool:** `src/tools/reflection.js` — reads session files, filters by date window and ignore patterns, extracts user messages, returns structured JSON data
- **Tool registration:** Add `reflection` to `src/tools/index.js` with `filesystem:read` permission and `orchestrator` classification
- **Reflection skill update:** Replace shell-based session discovery with a call to the new `reflection` tool, passing ignore patterns from guardrails as tool input
- **No new dependencies:** `js-yaml` (already a dependency) handles YAML parsing; `node:fs/promises` is built-in

## Capabilities

### New Capabilities
- `reflection-tool`: Session file reading, YAML frontmatter parsing, date window filtering, configurable ignore pattern filtering, user message extraction

### Modified Capabilities
- None (the reflection skill's narrative generation requirements remain unchanged; only the session discovery mechanism changes)

## Impact

- **Affected code:** `src/tools/reflection.js` (new), `src/tools/index.js` (registration), reflection skill (session discovery replacement)
- **Dependencies:** `js-yaml` already present — no new dependencies
- **Memory:** `memory/sessions/` directory structure is stable and relied upon
- **Testing:** New tool requires unit tests mirroring `src/tools/` structure in `tests/unit/`

## Non-goals

- Modifying the reflection skill's narrative generation logic
- Adding new session file formats or changing the existing session file structure
- Creating a general-purpose session reader module (this tool is specific to the reflection use case)
- Making ignore patterns configurable via config.yaml (tool input is sufficient)
