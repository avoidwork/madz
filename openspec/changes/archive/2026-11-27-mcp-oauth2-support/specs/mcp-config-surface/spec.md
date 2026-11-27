# Spec Delta

## ADDED Requirements

### Requirement: http/sse MCP servers support OAuth2 auth fields
The system SHALL accept optional `headers` (a flat `string -> string` record) and `authProvider` fields on `http` and `sse` MCP server configs, so OAuth2-protected remote MCP servers can be configured. The `stdio` transport SHALL NOT accept these fields.

#### Scenario: http server accepts headers and authProvider
- **WHEN** an `http` MCP server config includes `headers` and `authProvider`
- **THEN** the config passes schema validation and the fields are preserved

#### Scenario: sse server accepts headers and authProvider
- **WHEN** an `sse` MCP server config includes `headers` and `authProvider`
- **THEN** the config passes schema validation and the fields are preserved

#### Scenario: stdio server rejects headers
- **WHEN** a `stdio` MCP server config includes `headers`
- **THEN** the config fails schema validation

#### Scenario: headers must be a flat string record
- **WHEN** an `http` MCP server config includes `headers` with a non-string value (e.g. a nested object)
- **THEN** the config fails schema validation

### Requirement: OAuth2 auth fields flow through to the MCP adapter
The system SHALL pass the `headers` and `authProvider` fields of an `http`/`sse` MCP server config through to the MCP adapter unchanged, so the adapter can perform OAuth2 authentication.

#### Scenario: adapter receives auth fields
- **WHEN** an `http`/`sse` MCP server config includes `headers` and `authProvider`
- **THEN** the MCP adapter is constructed with those fields present in its connection params
