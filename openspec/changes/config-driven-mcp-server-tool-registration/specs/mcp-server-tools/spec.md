## ADDED Requirements

### Requirement: Config-driven MCP server registration
The system SHALL support a root-level `mcp` config key with a `servers` map. Each server entry SHALL specify a `transport` and its connection parameters.

#### Scenario: Empty mcp section is a no-op
- **WHEN** `config.yaml` has no `mcp` section or an empty `mcp: {}`
- **THEN** no MCP servers are registered and startup proceeds normally

#### Scenario: stdio server is registered
- **WHEN** `mcp.servers.<name>` has `transport: "stdio"`, `command`, and `args`
- **THEN** the server is configured as a local process-spawned MCP server

#### Scenario: http server is registered
- **WHEN** `mcp.servers.<name>` has `transport: "http"` and `url`
- **THEN** the server is configured as a Streamable HTTP MCP server

#### Scenario: sse server is registered
- **WHEN** `mcp.servers.<name>` has `transport: "sse"` and `url`
- **THEN** the server is configured as an HTTP + SSE MCP server

### Requirement: MCP tools are discovered at startup
The system SHALL connect to each configured MCP server at startup, discover its tools via `MCPAdapter.listTools()`, and register them alongside the built-in tools.

#### Scenario: Tools are discovered and registered
- **WHEN** a configured MCP server is reachable
- **THEN** its tools are discovered via `listTools()` and appended to the tool list

#### Scenario: Failed server is skipped
- **WHEN** a configured MCP server fails to connect
- **THEN** a warning is logged and the server is skipped without crashing startup

### Requirement: MCP adapter is closed on shutdown
The system SHALL keep the MCP adapter open for the agent's lifetime and close it on shutdown.

#### Scenario: Adapter is closed on shutdown
- **WHEN** the agent shuts down
- **THEN** the MCP adapter's `close()` is called

### Requirement: MCP tools are classified per server
Each MCP server SHALL support an optional `agents` list that determines which agent types receive its tools. When absent, tools default to the orchestrator only.

#### Scenario: Server with agents list
- **WHEN** `mcp.servers.<name>.agents` is set to `["coding", "research"]`
- **THEN** the server's tools are assigned to the `coding` and `research` agent types

#### Scenario: Server without agents list
- **WHEN** `mcp.servers.<name>` omits `agents`
- **THEN** the server's tools are assigned to the orchestrator only
