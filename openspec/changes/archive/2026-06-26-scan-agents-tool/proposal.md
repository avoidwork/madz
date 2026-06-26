## Why

Agents currently lack a dedicated tool to discover and load AGENTS.md from the current working directory. This means project-specific guidance files are not explicitly discoverable or loadable by agents during execution. Without a dedicated scan mechanism, agents cannot adapt their behavior based on project-specific conventions, rules, or context encoded in AGENTS.md files.

This tool enables agents to automatically find and use project-specific guidance files, making the workflow more adaptive to different project contexts. It provides an explicit, composable mechanism for agents to discover project context rather than relying on implicit or hardcoded assumptions.

## What Changes

- Add a new `scanAgents` tool that checks for AGENTS.md in a specified path (or current working directory)
- If AGENTS.md is found, the tool reads and returns its contents
- If AGENTS.md is not found, the tool completes silently with no error
- Tool accepts an optional `path` parameter (defaults to `process.cwd()`)
- Tool uses existing path validation infrastructure (`validatePath`, `checkFileLimit`) for safety
- Tool requires no sandbox permissions (always available, like `date` and `clarify`)
- Register tool in `src/tools/index.js` (TOOL_PERMISSIONS, TOOL_FACTORIES, buildToolConfig switch)

## Capabilities

### New Capabilities
- `scan-agents`: Discover and load AGENTS.md files from a specified path or current working directory. Returns file contents if found, empty string if not found.

### Modified Capabilities
<!-- None — this is a new capability, not a modification of existing specs -->

## Impact

- **Affected code**: `src/tools/index.js` (registration), new file `src/tools/scanAgents.js`
- **Dependencies**: `@langchain/core/tools`, `zod`, `node:fs/promises`, `node:path` — all already in use by other tools
- **No API changes**: This is an internal tool addition, no external API surface changes
- **No breaking changes**: Tool is additive, does not modify existing behavior