## MODIFIED Requirements

### Requirement: Tools SHALL be classified by agent type
Each tool in `src/tools/index.js` SHALL have a classification indicating which agent type(s) may use it. Classifications are: `orchestrator`, `subagent`, or `shared`. MCP tools discovered at runtime SHALL be classified by the per-server `agents` config list; when absent, they default to the orchestrator only.

#### Scenario: Classification map exists
- **WHEN** `src/tools/index.js` is loaded
- **THEN** a `TOOL_CLASSIFICATIONS` map exists mapping each tool name to one of: `orchestrator`, `subagent`, or `shared`

#### Scenario: All tools have a classification
- **WHEN** all tools are defined in `TOOL_FACTORIES`
- **THEN** every tool name has a corresponding entry in `TOOL_CLASSIFICATIONS`

#### Scenario: MCP tools are classified by per-server agents config
- **WHEN** an MCP server config specifies an `agents` list
- **THEN** the server's discovered tools are classified for those agent types

#### Scenario: MCP tools default to orchestrator
- **WHEN** an MCP server config omits `agents`
- **THEN** the server's discovered tools are classified for the orchestrator only
