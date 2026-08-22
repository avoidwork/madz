## Context

The madz project has two separate tools for command execution and process management:
- `shell` (src/tools/shell.js): Launches commands, supports foreground/background execution
- `process` (src/tools/process.js): Manages background process lifecycle (wait, kill, log, write, pause, resume, list)

These tools share a `processTracker` Map but require the agent to jump between them. Background processes are spawned with `stdio: ["ignore", "ignore", "ignore"]`, making stdout/stderr irretrievable — the `process` tool's `log` action returns placeholder text.

## Goals / Non-Goals

**Goals:**
- Merge shell and process into a single tool with action-based routing
- Fix stdio capture so `log` action returns actual output
- Add `list` action for process visibility
- Remove shell.js, consolidate into process.js
- Preserve existing processTracker, permissions, and classification model

**Non-Goals:**
- Change processTracker internal state management
- Add new spawn options beyond stdio fix
- Modify permission model (filesystem:exec + process:spawn preserved)
- Refactor other tools or subsystems

## Decisions

### Decision 1: Keep process.js as the unified home
**Rationale:** The process module is more feature-rich (7 actions vs 2 in shell). The processTracker is already defined here. Shell.js imports from process.js, creating a dependency that makes process.js the natural consolidation point.

### Decision 2: Action enum over optional parameters
**Rationale:** An explicit `action` enum is clearer than optional parameters. It prevents ambiguous calls and makes the tool schema self-documenting. The agent can reason about "start a command" vs "wait for a process" without guessing parameter combinations.

### Decision 3: Capture stdio at spawn time
**Rationale:** The current `stdio: ["ignore", "ignore", "ignore"]` is the root cause of the log action returning placeholder text. Changing to `stdio: ["ignore", "pipe", "pipe"]` captures output at spawn, stores it in processTracker, and makes it available to the log action. This is simpler than trying to attach to an already-running process's streams.

### Decision 4: Merge TOOL_CLASSIFICATIONS
**Rationale:** shell has `['coding']`, process has `['debug', 'code-review', 'research', 'coding']`. The unified tool should have the union: `['coding', 'debug', 'code-review', 'research']`.

## Risks / Trade-offs

### Risk: Breaking change for agents
**Impact:** Agents previously using separate `shell` and `process` tools must adapt to the unified interface.
**Mitigation:** The change is internal to the tool registration. Agent system prompts reference tool names — these need updating in AGENTS.md. The action-based interface is more explicit and easier to reason about.

### Risk: Stdio buffer size
**Impact:** Capturing all stdout/stderr could consume memory for long-running processes with large output.
**Mitigation:** Node.js spawn with pipe stdio uses backpressure by default. The streams are stored in the processTracker entry — for very large outputs, consider streaming to a temp file. For now, in-memory storage is acceptable for typical use cases.

### Risk: Test file removal
**Impact:** Removing shell.test.js means those test cases must be migrated to process.test.js.
**Mitigation:** Audit shell.test.js test cases and ensure each has a corresponding test in the unified process.test.js.

## Migration Plan

1. Create unified process.js with all action handlers
2. Update src/tools/index.js to register single tool
3. Remove shell.js and shell.test.js
4. Rewrite process.test.js with comprehensive tests
5. Update AGENTS.md tool descriptions
6. Run full test suite, lint, coverage

## Open Questions

None — all decisions resolved in proposal and design.