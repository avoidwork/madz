## MODIFIED Requirements

### Requirement: Agent uses Deep Agents instead of LangGraph ReAct
The system SHALL replace the LangGraph-based ReAct agent (`createReactAgent`) with a Deep Agents orchestrator while maintaining the same public API surface.

#### Scenario: callReactAgent uses Deep Agents internally
- **WHEN** `callReactAgent` is invoked
- **THEN** the Deep Agents orchestrator handles the request instead of the LangGraph ReAct agent

#### Scenario: callReactAgentStreaming uses Deep Agents internally
- **WHEN** `callReactAgentStreaming` is invoked
- **THEN** the Deep Agents orchestrator handles streaming events instead of the LangGraph ReAct agent

#### Scenario: Public API signatures remain unchanged
- **WHEN** callers invoke `callReactAgent` or `callReactAgentStreaming`
- **THEN** the function signatures and return types remain compatible with existing callers