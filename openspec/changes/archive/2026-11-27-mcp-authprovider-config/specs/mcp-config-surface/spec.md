# Spec Delta

## MODIFIED Requirements

### Requirement: http/sse MCP servers support OAuth2 auth fields
The system SHALL accept optional `headers` (a flat `string -> string` record) and a typed `authProvider` field on `http` and `sse` MCP server configs, so OAuth2-protected remote MCP servers can be configured. The `authProvider` field SHALL be a typed object (an OAuth client provider config) rather than an opaque `unknown` value, so its sub-fields can be materialized from environment variables. The `stdio` transport SHALL NOT accept these fields.

#### Scenario: http server accepts headers and authProvider
- **WHEN** an `http` MCP server config includes `headers` and a typed `authProvider`
- **THEN** the config passes schema validation and the fields are preserved

#### Scenario: sse server accepts headers and authProvider
- **WHEN** an `sse` MCP server config includes `headers` and a typed `authProvider`
- **THEN** the config passes schema validation and the fields are preserved

#### Scenario: stdio server rejects headers
- **WHEN** a `stdio` MCP server config includes `headers`
- **THEN** the config fails schema validation

#### Scenario: headers must be a flat string record
- **WHEN** an `http` MCP server config includes `headers` with a non-string value (e.g. a nested object)
- **THEN** the config fails schema validation

#### Scenario: authProvider must be a typed object
- **WHEN** an `http` MCP server config includes an `authProvider` that is not a valid typed object (e.g. a scalar or an object with invalid field types)
- **THEN** the config fails schema validation
