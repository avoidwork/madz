# Proposal

## Why

The root-level `mcp` config section exists in the Zod schema (`src/config/schemas/mcp.js`) and is registered in `src/config/config.js`, but the shipped `config.yaml` has no `mcp` key and env-var materialization for MCP servers is broken. Users cannot configure MCP servers through the config file or environment variables, leaving a documented configuration surface unusable in practice.

## What Changes

- Add a root-level `mcp:` section to `config.yaml` with example `stdio` and `http`/`sse` server entries matching the `McpSchema` discriminated union.
- Ensure `MCP_<SERVER>_<FIELD>` env vars materialize into `mcp.<server>.<field>` via the existing `__record__`/`__subpath__` reverse-map markers in `syncEnv()`.
- Fix the known bug where stdio server env vars like `MCP_LOCALFS_ENV_API_KEY` materialize as a nested object (`env: { api: { key: "..." } }`) that the `.strict()` schema rejects, since `env` must be a flat `string -> string` record.
- Add unit tests for MCP schema validation (all three transport variants, missing required fields) and integration tests for `MCP_*` env-var materialization including the flat `env` record regression.

## Capabilities

### New Capabilities

- `mcp-config-surface`: The root-level `mcp` config section exposed in `config.yaml` and materializable via `MCP_<SERVER>_<FIELD>` environment variables, including the flat `env` record for stdio servers.

### Modified Capabilities

- `mcp-server-tools`: The existing "Config-driven MCP server registration" requirement is updated to reflect the actual schema (a root-level `mcp` record of named servers, not a `servers` map) and to add env-var materialization support.

## Impact

- `config.yaml` — add the `mcp:` section.
- `src/config/loader.js` — fix `syncEnv()` record-pattern matching so stdio `env` vars materialize as a flat record.
- `tests/unit/config/schemas/mcp.test.js` — expand schema validation tests.
- `tests/unit/config_loader.test.js` — add integration tests for `MCP_*` env-var materialization.
- No new npm packages.

## Non-goals

- No changes to MCP tool discovery, adapter lifecycle, or per-server agent classification (already implemented in `src/tools/index.js`).
- No changes to the `McpSchema` itself or the `DROPPED_KEYS` list.
