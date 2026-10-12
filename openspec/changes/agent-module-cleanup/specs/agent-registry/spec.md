## REMOVED Requirements

### Requirement: Agent Registry
**Reason**: The `AgentRegistry` class in `src/agent/agentRegistry.js` has no production consumer — only its own test (`tests/unit/agentRegistry.test.js`) references it. It is dead code (YAGNI) and is removed.
**Migration**: No migration required. The registry was never used in production. Subagent definitions are managed directly via `agentDefinitions.js` (`AGENT_CONFIGS` + `getAllAgents()`) and `createSubagentDefinitions` in `deepAgents.js`.

### Requirement: Agent Lifecycle Management
**Reason**: The `AgentRegistry` class that provided add/remove/list lifecycle management is dead code with no production consumer and is removed.
**Migration**: No migration required. Agent lifecycle is handled by the static `AGENT_CONFIGS` array and the `createSubagentDefinitions` factory in `deepAgents.js`.
