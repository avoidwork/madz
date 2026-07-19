## ADDED Requirements

### Requirement: Tool Classification
The system SHALL categorize tools by agent type using `TOOL_CLASSIFICATIONS` in `src/tools/index.js`.

#### Scenario: Tools are classified by type
- **WHEN** tools are registered in the system
- **THEN** each tool is assigned to one or more agent type classifications

#### Scenario: Tool classification is queryable
- **WHEN** the system queries for tools by agent type
- **THEN** it returns only tools matching the specified classification

#### Scenario: Tools can have multiple classifications
- **WHEN** a tool is relevant to multiple agent types
- **THEN** the tool is assigned to all relevant classifications

### Requirement: Tool Filtering
The system SHALL filter tools based on agent type when invoking a subagent.

#### Scenario: Subagent receives filtered tools
- **WHEN** a subagent is invoked with a specific agent type
- **THEN** only tools matching that agent's classification are available

#### Scenario: Main thread receives all tools
- **WHEN** the main thread invokes a tool
- **THEN** all tools are available (no filtering)
