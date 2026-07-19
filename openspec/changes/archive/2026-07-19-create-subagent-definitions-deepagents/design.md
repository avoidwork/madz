## Context

The deepagents library currently supports a single `coding` subagent defined in `deepAgents.js`. The orchestrator routes requests to this agent using the `subAgent` tool. Our workflow regularly benefits from specialized agents with focused context windows and tool access, but the current architecture doesn't support multiple agent types.

The `TOOL_CLASSIFICATIONS` system in `src/tools/index.js` already provides a mechanism for categorizing tools, but it's not currently used to filter tools per agent. The orchestrator needs to be extended to support parallel execution of independent subagent calls.

## Goals / Non-Goals

**Goals:**
- Create a subagent definition framework with registry pattern
- Implement eight agents across three priority tiers:
  - High Priority: Search, Debug, Code Review, Research
  - Medium Priority: Testing, Documentation
  - Lower Priority: Security Audit, Performance
- Add tool filtering via `TOOL_CLASSIFICATIONS` to reduce context window usage
- Update orchestrator to support multiple subagent types and parallel execution
- Add comprehensive tests for agent definitions and parallel execution

**Non-Goals:**
- Create a UI for agent management
- Add agent persistence or state management between invocations
- Support dynamic agent creation at runtime
- Implement agent-to-agent communication protocols

## Decisions

### Decision 1: Registry Pattern for Agent Definitions

**Choice:** Use a registry pattern where subagent definitions are stored in a central registry and loaded/validated on startup.

**Rationale:**
- Makes it easy to add new agents without modifying core orchestrator logic
- Provides a single source of truth for agent definitions
- Enables validation of agent definitions before they're used
- Follows the existing pattern of tool registration in `src/tools/index.js`

**Alternatives Considered:**
- Inline definitions in orchestrator — would require modifying orchestrator for each new agent
- File-based definitions — adds I/O overhead and complexity
- Dynamic agent creation — adds unnecessary complexity for now

### Decision 2: Tool Filtering via TOOL_CLASSIFICATIONS

**Choice:** Filter tools per agent using the existing `TOOL_CLASSIFICATIONS` system in `src/tools/index.js`.

**Rationale:**
- Reduces context window usage by only passing relevant tools to each agent
- Prevents agents from accessing irrelevant tools
- Leverages existing infrastructure rather than creating new filtering logic
- Makes it easy to update tool categorization as new tools are added

**Alternatives Considerations:**
- Pass all tools to all agents — wastes context window and increases risk of misuse
- Create separate tool sets per agent — more complex, duplicates tool definitions
- Runtime tool selection — adds latency and complexity

### Decision 3: Output Format Contracts

**Choice:** Each agent defines its output format as part of its system prompt, with consistent structure across agents.

**Rationale:**
- Enables reliable parsing and composition by the main thread or other agents
- Makes agent outputs predictable and testable
- Allows the main thread to handle agent outputs uniformly
- Follows the existing pattern of structured outputs in tools

**Alternatives Considered:**
- Free-form agent outputs — harder to parse and compose
- JSON-only outputs — too restrictive for some agent types
- Schema validation — adds complexity, system prompts are sufficient for now

### Decision 4: Parallel Execution Support

**Choice:** Update the orchestrator to support concurrent subagent invocations when agents are independent.

**Rationale:**
- Improves throughput by allowing independent agents to run in parallel
- Matches the existing capability of the `task` tool for subagent spawning
- Provides significant performance benefits for multi-step workflows
- Can be implemented incrementally — start with sequential, add parallel later

**Alternatives Considered:**
- Sequential execution only — simpler but slower
- Full parallel execution with dependency resolution — more complex than needed
- User-specified parallelism — adds complexity to the API

## Risks / Trade-offs

### Risk 1: Increased Orchestrator Complexity
- **Impact:** More complex orchestration logic, harder to debug
- **Mitigation:** Keep the registry pattern simple, add comprehensive tests, document the API clearly

### Risk 2: Tool Filtering Overhead
- **Impact:** Small overhead from filtering tools per agent
- **Mitigation:** Cache filtered tool sets per agent type, profile and optimize if needed

### Risk 3: Context Window Management
- **Impact:** Multiple agents with large system prompts could exhaust context windows
- **Mitigation:** Keep system prompts concise, use tool filtering to reduce context, monitor context usage

### Risk 4: Agent Definition Maintenance
- **Impact:** Each new agent requires a definition file and tests
- **Mitigation:** Provide clear templates and examples, make the registry pattern easy to use

### Risk 5: Parallel Execution Race Conditions
- **Impact:** Concurrent agent invocations could cause race conditions or resource contention
- **Mitigation:** Ensure agents are stateless, use isolated context windows, add locking for shared resources if needed

## Migration Plan

### Phase 1: Framework and All Agents (This Change)
1. Add subagent definition framework and registry to `deepAgents.js`
2. Update `TOOL_CLASSIFICATIONS` in `src/tools/index.js`
3. Implement all eight agents across three priority tiers
4. Update orchestrator to support multiple agent types and parallel execution
5. Add tests and documentation

### Rollback Strategy
- The change is additive — no existing functionality is modified
- If issues arise, simply don't use the new agents
- The registry pattern makes it easy to remove agents without affecting core logic

## Open Questions

1. **Should agents have configurable parameters?** For now, keep agents simple with fixed system prompts. Parameters can be added later if needed.

2. **How should agent outputs be validated?** For now, rely on system prompts and testing. Add schema validation later if needed.

3. **Should agents be able to call other agents?** For now, keep agents independent. Cross-agent calls can be added later if the use case emerges.

4. **How should agent performance be monitored?** Add basic logging for now. Add metrics and monitoring later.
