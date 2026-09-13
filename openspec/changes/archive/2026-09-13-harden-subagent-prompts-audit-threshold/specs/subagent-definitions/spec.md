## MODIFIED Requirements

### Requirement: Subagent System Prompt
Each subagent SHALL have a system prompt that defines its role, capabilities, and output format. Each subagent system prompt SHALL include an explicit target audience, a success definition (what "done" looks like), a knowledge cutoff with graceful-degradation rules, and proactive clarification/error-fallback behavior.

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
