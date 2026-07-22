## ADDED Requirements

### Requirement: Deep Agents orchestrator manages specialized sub-agents
The system SHALL use LangChain Deep Agents to orchestrate specialized sub-agents (coding agent, utility agent) instead of spawning child Node.js processes for task delegation.

#### Scenario: Orchestrator routes coding tasks to coding agent
- **WHEN** the agent determines a task requires code-related work
- **THEN** the Deep Agents orchestrator routes the task to the coding sub-agent

#### Scenario: Orchestrator routes general tasks to utility agent
- **WHEN** the agent determines a task is a general utility task
- **THEN** the Deep Agents orchestrator routes the task to the utility sub-agent

#### Scenario: Sub-agents receive SUB_AGENT.md system prompt
- **WHEN** a sub-agent is invoked by the orchestrator
- **THEN** the sub-agent receives the SUB_AGENT.md system prompt as its context

### Requirement: Deep Agents provides native coordination
The system SHALL leverage Deep Agents' built-in coordination, state management, and observability for multi-agent workflows.

#### Scenario: Orchestrator tracks sub-agent state
- **WHEN** a sub-agent is executing
- **THEN** the orchestrator maintains awareness of the sub-agent's state and progress

#### Scenario: Orchestrator handles sub-agent failures
- **WHEN** a sub-agent fails during execution
- **THEN** the orchestrator captures the error and propagates it to the caller

### Requirement: Deep Agents provides native interruption
The system SHALL use Deep Agents' native interruption support instead of AbortController and manual orphaned process cleanup.

#### Scenario: Orchestrator interrupts executing sub-agent
- **WHEN** an interruption signal is received
- **THEN** the Deep Agents orchestrator gracefully stops the executing sub-agent

### Requirement: Deep Agents provides built-in loop detection
The system SHALL rely on Deep Agents' built-in loop detection instead of ad-hoc turn hash tracking.

#### Scenario: Orchestrator detects agent loop
- **WHEN** the orchestrator detects a looping pattern in agent behavior
- **THEN** the orchestrator triggers loop detection handling via Deep Agents