# Proposal

## Why

madz's MCP server config schema exposes `authProvider` on the `http`/`sse` transport variants as `z.unknown().optional()`. Because it is `z.unknown()`, the config loader's `buildReverseMap`/`syncEnv` cannot recurse into it, so `authProvider` sub-fields are never materialized from environment variables (e.g. `MCP_<SERVER>_AUTHPROVIDER_*` does not resolve). Additionally, madz ships no built-in `OAuthClientProvider` implementation for MCP servers, so an OAuth2-protected remote MCP server cannot be configured via env vars at all.

## What Changes

- Type the `authProvider` schema on the `http` and `sse` MCP server transport variants as a typed Zod object (an `OAuthClientProvider`-shaped config) instead of `z.unknown()`, so `buildReverseMap`/`syncEnv` can recurse into it and materialize `MCP_<SERVER>_AUTHPROVIDER_*` env vars.
- Add a built-in `OAuthClientProvider` implementation for MCP servers backed by the maintained `@langchain/auth` npm package (v0.1.0), so an OAuth2-protected remote MCP server can be configured without hand-writing a provider object in `config.yaml`.
- Add `@langchain/auth@^0.1.0` as a dependency.
- Add unit tests for schema validation of the typed `authProvider`, for `syncEnv` materializing `MCP_<SERVER>_AUTHPROVIDER_*`, and for the built-in provider.

## Capabilities

### New Capabilities
- `mcp-auth-provider`: A built-in `OAuthClientProvider` implementation for MCP servers, backed by `@langchain/auth`, enabling OAuth2-protected remote MCP servers to be configured without hand-writing a provider object.

### Modified Capabilities
- `mcp-config-surface`: The `http`/`sse` MCP server `authProvider` field is typed (not `z.unknown()`) so its sub-fields can be materialized from `MCP_<SERVER>_AUTHPROVIDER_*` env vars, and a built-in provider can be referenced.

## Impact

- `src/config/schemas/mcp.js` — type the `authProvider` schema on `http`/`sse` variants.
- `src/config/loader.js` — `buildReverseMap`/`syncEnv` recurse into the typed `authProvider` to materialize env vars.
- `src/tools/index.js` — pass the resolved `authProvider` through to `MCPAdapter` unchanged.
- New built-in provider module (e.g. `src/tools/mcp/authProvider.js`).
- `package.json` — add `@langchain/auth@^0.1.0`.
- Tests: `tests/unit/config/schemas/mcp.test.js`, `tests/unit/config/loader.test.js`, new provider tests.

## Non-goals

- No change to the `stdio` transport's accepted fields.
- No change to the existing static `headers` bearer-token pattern in `src/tools/poppy/api.js`.
