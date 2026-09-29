# subagent-definitions Specification

## Purpose
Framework for defining specialized subagents with focused tool access and system prompts. Enables the deepagents library to route tasks to domain-specific agents.
## Requirements
### Requirement: Subagent Definition Framework
The system SHALL provide a framework for defining specialized subagents with focused tool access and system prompts.

#### Scenario: Define a new subagent
- **WHEN** a developer creates a subagent definition with a name, system prompt, and tool filter
- **THEN** the subagent is registered and can be invoked by the orchestrator

#### Scenario: Subagent has focused tool access
- **WHEN** a subagent is invoked
- **THEN** only tools matching its classification are available in its context

### Requirement: Subagent System Prompt
Each subagent SHALL have a system prompt that defines its role, capabilities, and output format. Each subagent system prompt SHALL include an explicit target audience, a success definition (what "done" looks like), a knowledge cutoff with graceful-degradation rules, and proactive clarification/error-fallback behavior. When a subagent's prompt file fails to load, the system SHALL surface the failure at `warn` level (or fail fast) so the operator is aware the agent is running without its system prompt.

#### Scenario: System prompt is loaded
- **WHEN** a subagent is created
- **THEN** its system prompt is loaded and used when invoking the agent

#### Scenario: Output format is defined
- **WHEN** a subagent definition includes an output format
- **THEN** the agent structures its output according to the format

#### Scenario: System prompt defines audience and success metrics
- **WHEN** a subagent system prompt is evaluated
- **THEN** it includes an explicit target audience line and a success definition describing what a completed task looks like

#### Scenario: System prompt defines knowledge cutoff and degradation rules
- **WHEN** a subagent system prompt is evaluated
- **THEN** it includes a knowledge-cutoff line and graceful-degradation rules that instruct the agent to state assumptions and never fabricate when uncertain

#### Scenario: System prompt defines clarification and error-fallback behavior
- **WHEN** a subagent system prompt is evaluated
- **THEN** it includes a proactive clarification rule (ask when input is ambiguous) and an error-fallback behavior (report rather than loop on tool failures)

#### Scenario: Prompt file load failure is surfaced
- **WHEN** a subagent's prompt file is missing or unreadable
- **THEN** the system logs a warning at `warn` level (or throws) identifying the affected agent, rather than silently degrading at `debug` level

### Requirement: Subagent Validation
The system SHALL validate subagent definitions before registration.

#### Scenario: Invalid definition is rejected
- **WHEN** a subagent definition is missing required fields (name, system prompt)
- **THEN** the system rejects the definition and logs an error

#### Scenario: Valid definition is accepted
- **WHEN** a subagent definition includes all required fields
- **THEN** the system accepts and registers the definition

