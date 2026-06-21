## Why

The user wants to enable hierarchical agent execution — spawning sub-agents as child processes to handle discrete tasks. This allows for single delegation (offload a complex task with full context), fan-out (spawn multiple sub-agents in parallel or sequence to handle independent sub-tasks), and intelligent orchestration (parent decomposes complex tasks, decides which are independent vs dependent, and aggregates results).

## What Changes

- Add new `subAgent` tool that spawns `node index.js "PROMPT"` as child processes
- Support single execution mode with delegation instruction and optional context
- Support fan-out mode with parallel/sequential strategies, configurable concurrency, and error handling
- Add marker-based stdout parsing (`# SubAgent` marker) for result extraction
- Add `process.subAgent` configuration section to `config.yaml`
- Register tool in `src/tools/index.js` with `process:spawn` permission gate

## Capabilities

### New Capabilities
- `subagent`: Tool for spawning child-process agents with single execution and fan-out modes, marker-based result parsing, configurable timeouts and concurrency

### Modified Capabilities
<!-- None — no existing spec-level behavior changes -->

## Impact

- **New file:** `src/tools/subAgent.js` — tool implementation
- **Modified files:** `src/tools/index.js` — TOOL_PERMISSIONS, TOOL_FACTORIES, buildToolConfig
- **Modified files:** `config.yaml` — add `process.subAgent` configuration section
- **Dependencies:** Reuses `processTracker` from `src/tools/terminal.js`, mirrors spawn pattern from `src/tools/compaction.js`
- **Entry point:** No changes to `index.js` — leverages existing `node index.js "PROMPT" sessionsDir` pattern