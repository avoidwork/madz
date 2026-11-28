# mcp-auth-provider Specification

## Purpose

Provides a built-in OAuth client provider for MCP servers, backed by the maintained `@langchain/auth` SDK, so OAuth2-protected remote MCP servers can be configured without hand-writing a provider object.

## Requirements

### Requirement: Built-in OAuth client provider for MCP servers
The system SHALL ship a built-in OAuth client provider implementation for MCP servers that can be referenced from an `http`/`sse` MCP server config's `authProvider` field, so an OAuth2-protected remote MCP server can be configured without hand-writing a provider object in `config.yaml`. The provider SHALL support a browser-based authorization-code + PKCE flow with a callback server, and SHALL expose a `redirectUrl` for the callback URI so the SDK registers it and the authorization server redirects there.

#### Scenario: Provider is referenced from config
- **WHEN** an `http`/`sse` MCP server config's `authProvider` references the built-in provider with the required OAuth settings
- **THEN** the provider is constructed and used to authenticate the MCP server connection

#### Scenario: Provider uses the maintained OAuth SDK
- **WHEN** the built-in provider authenticates an MCP server
- **THEN** it delegates token acquisition to the `@langchain/auth` SDK rather than a hand-rolled OAuth implementation

#### Scenario: Provider exposes a callback redirect URL
- **WHEN** the provider is configured for the browser flow
- **THEN** its `redirectUrl` returns the callback URI so the SDK registers it and the authorization server redirects there

#### Scenario: Provider exchanges the authorization code
- **WHEN** the provider has a captured authorization code and code verifier
- **THEN** it exchanges the code for tokens via `prepareTokenRequest`

### Requirement: authProvider sub-fields are materializable from env vars
The system SHALL materialize `MCP_<SERVER>_AUTH_PROVIDER_<FIELD>` environment variables into the `mcp.<server>.authProvider.<field>` config path, so an OAuth2-protected MCP server's provider settings can be configured via environment variables.

#### Scenario: authProvider sub-fields materialize from env vars
- **WHEN** `MCP_<SERVER>_AUTH_PROVIDER_CLIENTID=...` and `MCP_<SERVER>_AUTH_PROVIDER_AUTHORIZATIONSERVER=...` are set
- **THEN** the config contains the corresponding `mcp.<server>.authProvider.<field>` values

#### Scenario: authProvider scopes array materializes from env vars
- **WHEN** `MCP_<SERVER>_AUTH_PROVIDER_SCOPES_0=app:mcp` and `MCP_<SERVER>_AUTH_PROVIDER_SCOPES_1=offline` are set
- **THEN** the config contains `mcp.<server>.authProvider.scopes` as an array of the materialized values

### Requirement: authProvider callback port and flow selection configurable
The system SHALL allow the callback port and flow selection for the MCP OAuth provider to be configured, and SHALL materialize the corresponding `MCP_<SERVER>_AUTH_PROVIDER_<FIELD>` environment variables into the `mcp.<server>.authProvider.<field>` config path.

#### Scenario: Callback port configurable
- **WHEN** the callback port is configured on the MCP server's `authProvider`
- **THEN** the provider uses that port for the callback server

#### Scenario: Callback port materializes from env var
- **WHEN** `MCP_<SERVER>_AUTH_PROVIDER_CALLBACK_PORT=...` is set
- **THEN** the config contains the corresponding `mcp.<server>.authProvider.callbackPort` value
