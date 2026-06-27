## Context

The madz project uses a tool-based architecture where each tool is a LangChain tool instance created by a factory function. Tools are registered in `src/tools/index.js` via two maps: `TOOL_PERMISSIONS` (name to required permission scopes) and `TOOL_FACTORIES` (name to factory function). The `buildToolConfig` function iterates over these maps, checks permissions, and instantiates tools with runtime options.

Currently, there is no dedicated tool for discovering and loading AGENTS.md files. Agents must rely on implicit context or manually use `readFile` with a known path. This creates a gap in the agent's ability to adapt to project-specific guidance.

## Goals / Non-Goals

**Goals:**
- Provide a simple, discoverable tool for finding and reading AGENTS.md files
- Follow the existing minimal tool pattern (like `date.js`)
- Reuse existing path validation infrastructure for safety
- Require no sandbox permissions (always available)
- Complete silently when AGENTS.md is not found

**Non-Goals:**
- Automatic injection of AGENTS.md into system prompt
- Recursive directory scanning for multiple AGENTS.md files
- Caching or performance optimization
- Parsing or interpreting AGENTS.md content
- Modifying existing tools to auto-load AGENTS.md

## Decisions

### Decision 1: Silent failure on missing file
**Choice:** Return empty string when AGENTS.md is not found, no error message.
**Rationale:** The tool is a discovery mechanism, not a requirement. Agents can check the result to determine presence. Error messages would create noise in the agent's workflow when AGENTS.md is simply not present in a given directory.
**Alternatives considered:**
- Return an error message — rejected because it creates noise for a non-problem
- Return null — rejected because the tool returns strings consistently

### Decision 2: No permissions required
**Choice:** Register with empty permission array `[]`, like `date` and `clarify`.
**Rationale:** Path safety is handled by `validatePath` and `checkFileLimit` from `src/tools/common.js`. The tool cannot read outside allowed paths regardless of permissions. Keeping it permission-free ensures it's always available.
**Alternatives considered:**
- Require `filesystem:read` — rejected because path validation already prevents unauthorized access
- Require a new `agents:read` permission — rejected because it adds unnecessary complexity

### Decision 3: Optional path parameter
**Choice:** Accept optional `path` string parameter, defaulting to `process.cwd()`.
**Rationale:** The common case is scanning the current working directory. Sub-agents working in other directories need the ability to specify a path. Making it optional keeps the API simple for the common case.
**Alternatives considered:**
- Required path parameter — rejected because it adds friction for the common case
- No path parameter, always use CWD — rejected because sub-agents need path control

### Decision 4: Reuse existing validation infrastructure
**Choice:** Use `validatePath` and `checkFileLimit` from `src/tools/common.js`.
**Rationale:** These utilities already handle path traversal prevention, symlink resolution, and size limits. Reusing them ensures consistent security across all tools.
**Alternatives considered:**
- Custom path validation — rejected because it duplicates existing, tested code

## Risks / Trade-offs

### Risk: Large AGENTS.md files
**Mitigation:** `checkFileLimit` enforces the configured max read size (default 1mb). Files exceeding this limit will be rejected with a clear error message.

### Risk: Path traversal via crafted path parameter
**Mitigation:** `validatePath` resolves the path against allowed paths and rejects any traversal attempts. This is the same protection used by `readFile`, `writeFile`, and other file tools.

### Trade-off: Simple vs. powerful
The tool is intentionally minimal. More complex features (recursive scanning, caching, format parsing) can be added later if needed. Starting simple reduces implementation risk and makes the tool easier to test and maintain.

### Trade-off: Raw string return
The tool returns raw file content as a string. The agent is responsible for parsing and incorporating the content. This keeps the tool composable and avoids making assumptions about how AGENTS.md should be used.

## Open Questions

None at this time. The design is straightforward and follows established patterns in the codebase.

---

## What Actually Happened

The original scope (a single `scanAgents` tool) was absorbed into a much larger change. The branch evolved into a comprehensive subAgent process management overhaul with the following additions beyond the original proposal:

### Added Scope

- **subAgent cwd enforcement** — The `subAgent` tool now requires an explicit `cwd` parameter, preventing sub-agents from operating in unintended directories. All file operations and relative paths are resolved from the specified working directory.
- **OS-level PID tracking** — Process results now include the OS-level PID, enabling proper lifecycle management (status reporting, graceful termination, log access) via the shared `processTracker`.
- **`loadAgents` workspace function** — A new `src/workspace/loadAgents.js` module discovers and loads `AGENTS.md` files from a specified path, replacing the previous implicit context approach.
- **`SUB_AGENT.md` prompt** — A dedicated system prompt for sub-agent execution, providing one-shot skill execution guidance with clear delegation patterns and behavioral anchors.
- **`--sub-agent` CLI flag** — The application now accepts a `--sub-agent` flag to run in sub-agent mode, with proper session isolation and environment filtering.
- **Tool exclusion in sub-agents** — `subAgent` and related tools (`subAgentLog`, `subAgentMessage`) are excluded from sub-agent tool sets to prevent recursive delegation.
- **Session isolation modes** — Three modes implemented: `isolated` (fresh session), `forked` (compaction in new session), `shared` (parent session).
- **Fan-out execution** — Parallel and sequential fan-out modes with configurable `maxConcurrent`, `onError` (continue/fail-fast), and timeout enforcement.
- **Configuration expansion** — `config.yaml` now includes `process.subAgent` section with timeout, maxConcurrent, sessionMode, defaultStrategy, and defaultOnError settings.
- **Memory and session refactoring** — Changes to `src/memory/` (context, expireEphemeral, loadMemories, prompts, retention, writer) and `src/session/` (index, loader, saver, stateManager) to support the new delegation model.
- **TUI updates** — Changes to `src/tui/app.js`, `contextTokens.js`, `inputPanel.js`, and `statusBar.js` to reflect the expanded tool set and process management.
- **Scheduler changes** — `src/scheduler/autoSchedule.js` updated to work with the new process tracking.
- **Agent refactoring** — `src/agent/react.js` updated for the new delegation patterns.
- **Cache updates** — `src/cache/llm_cache.js` adjusted for the new context flow.
- **Config schema updates** — `src/config/schemas.js` and `loader.js` updated to support new configuration sections.
- **Tool registration changes** — `src/tools/index.js` updated with new tools, permission gates, and factory registrations.
- **Additional tools** — `compaction.js`, `cron.js`, `memory.js`, `sampling.js`, `session_search.js` all received updates to align with the new architecture.
- **Skill updates** — `skills/audit-code/SKILL.md` created with new sub-agent delegation patterns.
- **Documentation** — `README.md` updated to reflect the new capabilities and project layout.

### Impact Assessment

The delta between the original proposal and the final implementation is significant. What began as a 3-task, ~100-line change expanded to a 60+ file modification across the entire codebase. The core value — enabling agents to discover and use project-specific guidance — remains, but the delivery mechanism shifted from a simple tool to a full delegation infrastructure.

### Lessons Learned

- Scope creep is real. A "simple tool" can become a platform.
- The `scanAgents` tool was the canary in the coal mine — it exposed the need for proper workspace context, which cascaded into everything else.
- The final architecture is more robust and composable than the original plan, but the archival should reflect the actual scope, not the aspirational one.