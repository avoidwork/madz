# Spec Delta

## Purpose

Exposes the root-level `mcp` config section in `config.yaml` and supports configuring MCP servers via `MCP_<SERVER>_<FIELD>` environment variables, including a flat `env` record for stdio servers.

## ADDED Requirements

### Requirement: MCP config section is present in config.yaml
The system SHALL ship a root-level `mcp` section in `config.yaml` with example server entries matching the MCP server schema, so users can configure MCP servers through the config file.

#### Scenario: config.yaml contains an mcp section
- **WHEN** the shipped `config.yaml` is loaded
- **THEN** it contains a root-level `mcp` key with at least one example server entry

#### Scenario: Example entries match the schema
- **WHEN** the `mcp` section is validated against the MCP server schema
- **THEN** each example server entry passes validation for its transport variant

### Requirement: MCP servers are configurable via environment variables
The system SHALL materialize `MCP_<SERVER>_<FIELD>` environment variables into the `mcp.<server>.<field>` config path, enabling MCP server configuration without editing `config.yaml`.

#### Scenario: http server env vars materialize
- **WHEN** `MCP_DOCS_TRANSPORT=http` and `MCP_DOCS_URL=https://example.com/mcp` are set
- **THEN** the config contains `mcp.docs.transport = "http"` and `mcp.docs.url = "https://example.com/mcp"`

#### Scenario: stdio server env vars materialize
- **WHEN** `MCP_LOCALFS_TRANSPORT=stdio` and `MCP_LOCALFS_COMMAND=npx` are set
- **THEN** the config contains `mcp["local-fs"].transport = "stdio"` and `mcp["local-fs"].command = "npx"`

### Requirement: stdio env vars materialize as a flat record
The system SHALL materialize `MCP_<SERVER>_ENV_<KEY>` environment variables as a flat `string -> string` record under `mcp.<server>.env`, not as a nested object.

#### Scenario: env var materializes flat
- **WHEN** `MCP_LOCALFS_ENV_API_KEY=secret` is set
- **THEN** the config contains `mcp["local-fs"].env.API_KEY = "secret"` as a flat record

#### Scenario: nested env object is rejected
- **WHEN** a stdio server's `env` value is a nested object (e.g. `{ api: { key: "..." } }`)
- **THEN** the config fails schema validation because `env` must be a flat `string -> string` record
