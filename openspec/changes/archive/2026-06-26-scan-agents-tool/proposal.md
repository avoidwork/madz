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

---

## What Actually Happened

The original proposal was narrowly scoped to a single `scanAgents` tool. The implementation expanded into a comprehensive subAgent process management platform. The following changes were made beyond the original proposal:

### Expanded Scope

- **subAgent cwd enforcement** — `subAgent` now requires an explicit `cwd` parameter. All file operations resolve from this directory.
- **OS-level PID tracking** — Process results include the OS-level PID for lifecycle management via `processTracker`.
- **`loadAgents` workspace function** — New `src/workspace/loadAgents.js` discovers and loads `AGENTS.md` files, replacing implicit context.
- **`SUB_AGENT.md` prompt** — Dedicated system prompt for sub-agent execution with delegation patterns and behavioral anchors.
- **`--sub-agent` CLI flag** — Application accepts `--sub-agent` flag for sub-agent mode with session isolation and environment filtering.
- **Tool exclusion** — `subAgent`, `subAgentLog`, and `subAgentMessage` are excluded from sub-agent tool sets to prevent recursion.
- **Session isolation modes** — Three modes: `isolated` (fresh session), `forked` (compaction in new session), `shared` (parent session).
- **Fan-out execution** — Parallel and sequential modes with `maxConcurrent`, `onError` (continue/fail-fast), and timeout enforcement.
- **Configuration** — `config.yaml` includes `process.subAgent` section with timeout, maxConcurrent, sessionMode, defaultStrategy, defaultOnError.
- **Memory refactoring** — Changes to `src/memory/` (context, expireEphemeral, loadMemories, prompts, retention, writer).
- **Session refactoring** — Changes to `src/session/` (index, loader, saver, stateManager).
- **TUI updates** — Changes to `src/tui/app.js`, `contextTokens.js`, `inputPanel.js`, `statusBar.js`.
- **Scheduler updates** — `src/scheduler/autoSchedule.js` updated for process tracking.
- **Agent refactoring** — `src/agent/react.js` updated for new delegation patterns.
- **Cache updates** — `src/cache/llm_cache.js` adjusted for new context flow.
- **Config schema updates** — `src/config/schemas.js` and `loader.js` updated for new configuration sections.
- **Tool registration** — `src/tools/index.js` updated with new tools, permission gates, and factory registrations.
- **Additional tool updates** — `compaction.js`, `cron.js`, `memory.js`, `sampling.js`, `session_search.js` aligned with new architecture.
- **Skill updates** — `skills/audit-code/SKILL.md` created with sub-agent delegation patterns.
- **Documentation** — `README.md` updated with new capabilities and project layout.

### Scope Delta

| Aspect | Original Proposal | Actual Implementation |
|--------|------------------|----------------------|
| Files changed | ~3 files | 60+ files |
| New capabilities | 1 (`scan-agents`) | 2+ (`scan-agents`, `subagent`) |
| Configuration | None | `process.subAgent` section |
| CLI flags | None | `--sub-agent`, `--cwd` |
| Session modes | None | 3 modes (isolated, forked, shared) |
| Execution modes | Single | Single + fan-out (parallel/sequential) |
| Prompt files | None | `SUB_AGENT.md`, `SYSTEM_PROMPT.md` |
| Test files | 1 new | 5+ new/modified |

### Lessons Learned

- A "simple tool" can expose deeper architectural needs. The `scanAgents` tool revealed the lack of proper workspace context, which cascaded into the full delegation infrastructure.
- Scope creep is inevitable when the initial change exposes systemic gaps. The question is whether to acknowledge it in the spec or pretend the original scope was the whole story.
- The final architecture is more robust and composable than the original plan. Honesty in the archival serves future reference better than a sanitized version of events.