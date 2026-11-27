# Spec Delta

## MODIFIED Requirements

### Requirement: Config-driven MCP server registration
The system SHALL support a root-level `mcp` config key that is a record of named servers. Each server entry SHALL specify a `transport` and its connection parameters.

#### Scenario: Empty mcp section is a no-op
- **WHEN** `config.yaml` has no `mcp` section or an empty `mcp: {}`
- **THEN** no MCP servers are registered and startup proceeds normally

#### Scenario: stdio server is registered
- **WHEN** `mcp.<name>` has `transport: "stdio"`, `command`, and `args`
- **THEN** the server is configured as a local process-spawned MCP server

#### Scenario: http server is registered
- **WHEN** `mcp.<name>` has `transport: "http"` and `url`
- **THEN** the server is configured as a Streamable HTTP MCP server

#### Scenario: sse server is registered
- **WHEN** `mcp.<name>` has `transport: "sse"` and `url`
- **THEN** the server is configured as an HTTP + SSE MCP server
