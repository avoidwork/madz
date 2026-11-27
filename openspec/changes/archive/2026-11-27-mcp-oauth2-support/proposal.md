# Proposal

## Why

OAuth2-protected MCP services such as base44.com cannot be used as MCP tools in madz because the MCP config schema does not expose OAuth2 fields. The underlying `@langchain/mcp-adapters` v2 library already supports OAuth2 for `http`/`sse` transports via `headers` and `authProvider`, but madz's config surface rejects any config specifying them, so the capability is unreachable.

## What Changes

- Add an optional `headers` field (`Record<string,string>`) to the `http` and `sse` variants of the MCP server schema.
- Add an optional `authProvider` field to the `http` and `sse` variants, passed through to the adapter unchanged.
- Leave the `stdio` variant unchanged (OAuth2 does not apply to process-spawned servers).
- Add unit tests covering acceptance/rejection of the new fields per transport.
- Add an integration test confirming the adapter receives the auth fields.
- Document the new `headers`/`authProvider` config fields.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mcp-config-surface`: The MCP server config schema gains optional `headers` and `authProvider` fields on the `http` and `sse` transport variants, enabling OAuth2-protected remote MCP servers to be configured.

## Impact

- `src/config/schemas/mcp.js` — extend the `http` and `sse` variants of `McpServerSchema`.
- `src/tools/index.js` — no code change required; the existing spread already forwards non-`agents` fields to the adapter.
- `tests/unit/config/schemas/mcp.test.js` — new unit tests.
- `tests/integration/` — new integration test.
- Documentation — MCP config reference.
- Dependency: `@langchain/mcp-adapters` v2 (already present).
