## Context

The current madz application uses LangGraph's `createReactAgent` prebuilt agent in `src/agent/react.js` for task execution. When the agent needs to delegate specialized work (coding, utility tasks), it uses the subAgent tool family which spawns child Node.js processes via `node index.js --sub-agent`. Each sub-agent invocation requires a full Node.js process startup, introducing significant latency and resource overhead.

The current architecture has several limitations:
- Process spawning for every delegation creates startup latency and resource waste
- No native coordination between orchestrator and sub-agents
- Limited observability into sub-agent lifecycle and state
- Complex manual error handling for fan-out strategies (parallel/sequential)
- Ad-hoc turn hash tracking for loop detection that isn't useful in practice
- Interruption relies on AbortController and manual orphaned process cleanup

Deep Agents from `@langchain/deepagents` provides a native multi-agent orchestration framework with built-in state management, event handling, and observability.

## Goals / Non-Goals

**Goals:**
- Replace process-spawning subAgent with native Deep Agents orchestration
- Eliminate process overhead while maintaining delegation semantics
- Improve observability and error handling for multi-agent workflows
- Remove turn hash tracking in favor of Deep Agents built-in loop detection
- Maintain public API compatibility (`callReactAgent`, `callReactAgentStreaming`)
- Update TUI streaming callback to work with Deep Agents event model

**Non-Goals:**
- Migrating existing users to Deep Agents (not applicable — this is internal refactoring)
- Adding new agent types beyond coding and utility agents
- Changing the TUI event display format (only the source events change)
- Modifying the skills registry or permissions system

## Decisions

### Decision 1: Use `@langchain/deepagents` as the orchestration layer
**Rationale:** Deep Agents is specifically designed for LangChain/LangGraph ecosystems, providing native integration with existing LangGraph state management and tool calling. Alternatives like LangGraph's native multi-agent support were considered but Deep Agents provides better orchestration primitives for this use case.

### Decision 2: Maintain public API surface
**Rationale:** The `callReactAgent` and `callReactAgentStreaming` functions in the agent module will maintain their signatures to minimize changes in `index.js` and TUI code. This reduces the risk of breaking existing callers.

### Decision 3: Delete subAgent tool family entirely
**Rationale:** The subAgent tools (`subAgent.js`, `subAgentLog.js`, `subAgentMessage.js`) are tightly coupled to the process-spawning architecture. Deep Agents provides native delegation, making these tools obsolete. Keeping them would add maintenance burden without benefit.

### Decision 4: Remove turn hash tracking
**Rationale:** The ad-hoc turn-level loop detection via hash tracking in the streaming callback is not useful in practice. Deep Agents provides built-in loop detection that is more robust and doesn't require configuration (`turnHashWindow`, `turnBufferMax`).

### Decision 5: Retain `processTracker` in `src/tools/terminal.js`
**Rationale:** The `processTracker` Map and `trackProcess` function are used by the `process` tool for background process management, not just by subAgent. This code should be retained and potentially refactored if Deep Agents provides its own process management.

## Risks / Trade-offs

[Risk] Deep Agents API may differ significantly from LangGraph's prebuilt agent
→ [Mitigation] Maintain public API surface; isolate changes to internal implementation

[Risk] Streaming event model may not map 1:1 to current TUI events
→ [Mitigation] Create an event adapter layer in the streaming callback to map Deep Agents events to existing TUI event types

[Risk] Behavioral changes in agent delegation may affect user experience
→ [Mitigation] Thorough testing of delegation patterns; maintain same system prompts for sub-agents

[Risk] New dependency introduces potential compatibility issues
→ [Mitigation] Pin version; test with existing LangGraph components; monitor for breaking changes

[Risk] Compaction integration may require significant refactoring
→ [Mitigation] Start with basic compaction support; iterate on deeper integration if needed