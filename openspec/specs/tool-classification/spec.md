# tool-classification Specification

## Purpose
TBD - created by archiving change classify-assign-tools-skills-orchestrator-subagents. Update Purpose after archive.
## Requirements
### Requirement: Tools SHALL be classified by agent type
Each tool in `src/tools/index.js` SHALL have a classification indicating which agent type(s) may use it. Classifications are: `orchestrator`, `subagent`, or `shared`.

#### Scenario: Classification map exists
- **WHEN** `src/tools/index.js` is loaded
- **THEN** a `TOOL_CLASSIFICATIONS` map exists mapping each tool name to one of: `orchestrator`, `subagent`, or `shared`

#### Scenario: All tools have a classification
- **WHEN** all tools are defined in `TOOL_FACTORIES`
- **THEN** every tool name has a corresponding entry in `TOOL_CLASSIFICATIONS`

### Requirement: `buildToolConfig()` SHALL support classification filtering
The `buildToolConfig()` function SHALL accept an optional `classificationFilter` parameter that filters tools by their classification.

#### Scenario: No filter returns all tools
- **WHEN** `buildToolConfig()` is called without `classificationFilter`
- **THEN** all tools that pass permission checks are included (current behavior)

#### Scenario: Filter with orchestrator classification
- **WHEN** `buildToolConfig()` is called with `classificationFilter: ['orchestrator', 'shared']`
- **THEN** only tools classified as `orchestrator` or `shared` are included

#### Scenario: Filter with subagent classification
- **WHEN** `buildToolConfig()` is called with `classificationFilter: ['subagent', 'shared']`
- **THEN** only tools classified as `subagent` or `shared` are included

### Requirement: Orchestrator SHALL receive only orchestrator-classified and shared tools
The orchestrator agent in `deepAgents.js` SHALL receive a filtered tool set containing only tools classified as `orchestrator` or `shared`.

#### Scenario: Orchestrator tool assignment
- **WHEN** `createDeepAgentsOrchestrator()` creates the orchestrator
- **THEN** the orchestrator receives tools filtered by `['orchestrator', 'shared']`

### Requirement: Subagents SHALL receive subagent-classified and shared tools
Subagent agents in `deepAgents.js` SHALL receive a filtered tool set containing only tools classified as `subagent` or `shared`.

#### Scenario: Coding subagent tool assignment
- **WHEN** `createDeepAgentsOrchestrator()` creates the coding subagent
- **THEN** the coding subagent receives tools filtered by `['subagent', 'shared']`

### Requirement: Skills SHALL be classified by agent type
Skills SHALL be classified into categories: `orchestrator`, `subagent`, or `shared`. The orchestrator SHALL receive only orchestrator-classified and shared skills. Subagents SHALL receive all skills (subagent and shared).

#### Scenario: Skill path filtering for orchestrator
- **WHEN** `createDeepAgentsOrchestrator()` assigns skills to the orchestrator
- **THEN** only skills classified as `orchestrator` or `shared` are included

#### Scenario: Skill path filtering for subagent
- **WHEN** `createDeepAgentsOrchestrator()` assigns skills to the coding subagent
- **THEN** all skills are included (subagent and shared)

### Requirement: Classification SHALL be documented for new tools
When a new tool is added to `src/tools/index.js`, its classification SHALL be documented in the `TOOL_CLASSIFICATIONS` map and in code comments.

#### Scenario: New tool requires classification
- **WHEN** a new tool is added to `TOOL_FACTORIES`
- **THEN** a corresponding entry MUST be added to `TOOL_CLASSIFICATIONS` with a clear rationale

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

