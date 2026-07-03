## ADDED Requirements

### Requirement: Orchestrator SHALL have minimal tool set for coordination
The orchestrator agent SHALL only receive tools necessary for its coordination role: delegation, routing, and synthesis. It SHALL NOT receive execution tools (terminal, code editing, file operations).

#### Scenario: Orchestrator lacks execution tools
- **WHEN** the orchestrator is created
- **THEN** tools like `terminal`, `process`, `executeCode`, and `todo` are NOT available to the orchestrator

#### Scenario: Orchestrator has coordination tools
- **WHEN** the orchestrator is created
- **THEN** tools like `clarify`, `sessionSearch`, and `scanAgents` are available to the orchestrator

### Requirement: Subagents SHALL have execution tools for task completion
Subagent agents SHALL receive tools necessary for their execution role: file operations, code editing, terminal access, and task management.

#### Scenario: Coding subagent has execution tools
- **WHEN** the coding subagent is created
- **THEN** tools like `terminal`, `process`, `todo`, `executeCode`, and `web` tools are available

### Requirement: Shared tools SHALL be available to both agents
Tools classified as `shared` SHALL be available to both the orchestrator and subagents.

#### Scenario: Shared tool availability
- **WHEN** a tool is classified as `shared`
- **THEN** it is available to both the orchestrator and all subagents

### Requirement: Tool assignment SHALL be configurable per agent type
The tool assignment system SHALL support adding new agent types with custom tool sets without modifying the core classification logic.

#### Scenario: Adding a new agent type
- **WHEN** a new subagent type is added to `deepAgents.js`
- **THEN** it can receive a custom tool set by specifying the appropriate classification filter