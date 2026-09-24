# subagent-tool-visibility Specification

## Purpose
TBD - created by archiving change subagent-tool-capabilities. Update Purpose after archive.
## Requirements
### Requirement: Subagent description SHALL include its tool list
Each subagent definition produced by `createSubagentDefinitions()` in `src/agent/deepAgents.js` SHALL have a `description` field that includes a comma-separated list of the tools assigned to that subagent, derived from `getToolsForAgentTypes(classifications, TOOLS)`. This is the field deepagents renders to the orchestrator via `describeSubagentForTool()`, so the orchestrator can see which tools each subagent carries.

#### Scenario: Subagent description includes its tools
- **WHEN** `createSubagentDefinitions()` builds a subagent definition for an agent that has tools
- **THEN** the definition's `description` ends with a `Tools: <comma-separated tool names>` suffix listing exactly the tool names returned by `getToolsForAgentTypes()`

#### Scenario: Subagent with no tools omits the suffix
- **WHEN** `createSubagentDefinitions()` builds a subagent definition for an agent whose `getToolsForAgentTypes()` result is empty
- **THEN** the definition's `description` does not contain a `Tools:` suffix

### Requirement: Tool list matches getToolsForAgentTypes
The tool names rendered in a subagent's description SHALL match exactly the names returned by `getToolsForAgentTypes(classifications, TOOLS)` for that agent's classification, in the same order.

#### Scenario: Tool names match the source of truth
- **WHEN** a subagent's description is parsed for its `Tools:` list
- **THEN** the parsed tool names equal the array returned by `getToolsForAgentTypes()` for that agent's classification

### Requirement: Existing tools array is preserved
The `tools` array on each subagent definition (actual tool instances) SHALL remain populated as before; the description change is additive and does not alter which tools are attached to the subagent.

#### Scenario: Tools array still contains instances
- **WHEN** `createSubagentDefinitions()` builds a subagent definition
- **THEN** the definition's `tools` array still contains the tool instances mapped from `filteredToolNames`

