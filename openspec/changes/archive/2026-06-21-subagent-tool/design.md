## Context

The madz agent system currently supports single-agent execution via `node index.js "PROMPT" sessionsDir`. The compaction tool already demonstrates this pattern — it spawns a child process, captures stdout, and parses it using a marker-based approach. The user wants to generalize this pattern into a reusable `subAgent` tool that enables hierarchical agent execution: the parent agent can decompose complex tasks, spawn sub-agents to handle independent sub-tasks, and aggregate results.

The closest existing pattern is `src/tools/compaction.js`, which uses `spawn("node", [indexPath, `"${command}"`, sessionsDir])` with a `# Compaction` marker. The terminal tool provides `processTracker` for PID tracking and process lifecycle management.

## Goals / Non-Goals

**Goals:**
- Single execution mode: spawn one sub-agent with delegation + context, return structured result
- Fan-out mode: spawn multiple sub-agents in parallel or sequential batches with configurable concurrency
- Marker-based stdout parsing: sub-agents prepend `# SubAgent` marker; parent splits on it
- Response contract: `{ ok, result, error? }` matching compaction tool pattern
- Process tracking via shared `processTracker` from terminal.js
- Configurable timeouts (per-call > env var > config default)
- Optional parameter extraction from JSON results via `returnParams`
- Session isolation modes: isolated (fresh), forked (compaction in new session), shared (parent session)

**Non-Goals:**
- Changes to `index.js` entry point — leverages existing pattern
- TUI changes or UI modifications
- Skill system changes
- HTTP-based sub-agents (rejected in issue — don't give full tool ecosystem access)
- In-process sub-agents (rejected — no process isolation)
- Full session dump to sub-agents (rejected — too much context, wastes tokens)

## Decisions

### Decision 1: Marker-based stdout parsing (not JSON lines or HTTP)
**Choice:** Use `# SubAgent` marker prefix, split stdout on marker to extract result.
**Rationale:** Mirrors compaction tool pattern exactly. Simple, reliable, works with any sub-agent output format. The sub-agent prepends the marker; the parent splits and takes everything after the first occurrence.
**Alternatives considered:**
- JSON lines: Requires sub-agent to format output as JSON, adds parsing complexity
- HTTP endpoint: Rejected in issue — loses full tool ecosystem access
- In-process: Rejected — no isolation, state corruption risk

### Decision 2: Shared processTracker from terminal.js
**Choice:** Reuse `processTracker` Map and `trackProcess` function from `src/tools/terminal.js`.
**Rationale:** Avoids duplicating process management logic. Enables consistent PID tracking, status reporting, and lifecycle management across all process-spawning tools.
**Trade-off:** Tighter coupling between terminal.js and subAgent.js, but both are internal tools with shared lifecycle.

### Decision 3: Timeout resolution priority
**Choice:** Per-call `timeout` parameter > `MADZ_SUBAGENT_TIMEOUT` env var > `config.yaml` default.
**Rationale:** Follows the principle of least surprise — explicit per-call overrides take precedence, environment variables provide runtime flexibility, config provides sensible defaults.
**Implementation:** Resolve timeout in this order at spawn time; pass to `spawn()` options.

### Decision 4: Fan-out concurrency control
**Choice:** Use a semaphore pattern with `maxConcurrent` limit. Tasks are queued; when a slot opens (process exits), the next task starts.
**Rationale:** Prevents resource exhaustion. For parallel mode, bounded by `maxConcurrent`. For sequential mode, effectively `maxConcurrent: 1`.
**Implementation:** Track active processes; when count < maxConcurrent, dequeue next task.

### Decision 5: Prompt structure with `|||` separator
**Choice:** `[context] ||| [delegation]` — sub-agent recognizes `|||` and treats everything after as the task.
**Rationale:** Simple, unambiguous separator. Sub-agent can parse it and know what context vs instruction is. Works with any content in either section.
**Escaping:** Full prompt is shell-escaped (quotes, backticks, dollar signs, newlines) before passing to spawn.

### Decision 6: Session isolation modes
**Choice:** Three modes — `isolated` (fresh session, default), `forked` (compaction in new session), `shared` (parent session).
**Rationale:** Different use cases need different isolation levels. Isolated is safest (no state leakage). Forked provides context without full session dump. Shared is for special cases where sub-agent needs parent's full context (not recommended for fan-out).
**Implementation:** Pass session mode to spawned process; index.js respects it when initializing agent.

## Risks / Trade-offs

### Risk: Shell injection via prompt content
**Mitigation:** Full shell escaping of prompt before passing to spawn. The command is passed as a quoted argument: `spawn("node", [indexPath, `"${escapedPrompt}"`, sessionsDir])`. This is the same pattern used by compaction tool.

### Risk: Boot overhead for fan-out
**Mitigation:** Each `node index.js` spawn loads config, tools, skills (~seconds). Bounded by `maxConcurrent` to prevent resource exhaustion. For frequent small tasks, consider batching.

### Risk: Recursive sub-agent spawning
**Mitigation:** Sub-agents can spawn their own sub-agents. Track depth counter; decrement on each recursive spawn. Max depth bounded by `maxConcurrent` (not n+1 per level).

### Risk: Large sub-agent outputs
**Mitigation:** `returnParams` allows filtering to specific keys. If output is very large and no params specified, parent can truncate or summarize. Consider adding a `maxOutputSize` config option in future.

### Risk: Process cleanup on error
**Mitigation:** SIGTERM → SIGKILL graceful termination. ProcessTracker tracks all spawned processes; cleanup on parent exit. Timeout enforcement prevents hung processes.

## Migration Plan

This is a new feature with no migration required. The tool is opt-in — it only registers when `process:spawn` permission is enabled in config. Existing agents and tools are unaffected.

1. Add `src/tools/subAgent.js`
2. Register in `src/tools/index.js` (TOOL_PERMISSIONS, TOOL_FACTORIES)
3. Add `process.subAgent` config to `config.yaml`
4. Add unit tests
5. Verify existing test suite passes
6. Verify application starts without crashing

## Open Questions

1. **Session mode default:** `isolated` is the safest default, but `forked` might be more useful for most use cases. Current decision: `isolated` as default, user can change in config.
2. **Recursive depth limit:** Should there be a hard max depth (e.g., 3 levels)? Current approach: bounded by `maxConcurrent` which implicitly limits depth. May need explicit depth counter in future.
3. **Output size limits:** Should there be a configurable max output size? Current approach: no limit, but `returnParams` helps filter. May add `maxOutputSize` config in future.