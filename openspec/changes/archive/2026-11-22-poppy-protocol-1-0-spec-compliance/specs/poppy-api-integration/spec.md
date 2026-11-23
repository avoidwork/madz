# Spec Delta

## MODIFIED Requirements

### Requirement: Remote MCP servers are called over Streamable HTTP transport
The system SHALL call a remote MCP server over Streamable HTTP transport (MCP protocol 2025-06-18 or later) with the session header, requesting a token with `resource` set to the MCP server's URL. The MCP token request SHALL use a `private_key_jwt` client assertion rather than `client_credentials`.

#### Scenario: MCP server is called with session header
- **WHEN** a remote MCP server is called
- **THEN** the request includes the `Poppy-Session` header

#### Scenario: Token is requested with the MCP server URL as resource
- **WHEN** a token is requested for an MCP server call
- **THEN** the token request sets `resource` to the MCP server's URL

#### Scenario: MCP token request uses private_key_jwt client assertion
- **WHEN** a token is requested for an MCP server call
- **THEN** the token request uses a `private_key_jwt` client assertion rather than `client_credentials`
