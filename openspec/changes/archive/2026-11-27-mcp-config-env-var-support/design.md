# Design

## Context

See proposal.md - Why. The `McpSchema` (`src/config/schemas/mcp.js`) is a `z.record(z.string(), McpServerSchema).default({})` where each server is a `z.discriminatedUnion("transport", ...)` with `stdio`, `http`, and `sse` variants, all `.strict()`. It is registered in `ConfigSchema` at `src/config/config.js:97`. The tool wiring in `src/tools/index.js` reads `config?.mcp` and constructs an `MCPAdapter` per server. The only missing pieces are the `config.yaml` surface and correct env-var materialization.

## Goals / Non-Goals

- **Goals:** Expose the `mcp` section in `config.yaml`; make `MCP_<SERVER>_<FIELD>` env vars materialize correctly; fix the stdio `env` nested-object bug.
- **Non-Goals:** No changes to `McpSchema`, `DROPPED_KEYS`, MCP tool discovery, adapter lifecycle, or per-server agent classification.

## Decisions

### Decision 1: Keep `mcp` out of `DROPPED_KEYS`
The env-var prefix for `mcp` is `MCP_` because `mcp` is not in `DROPPED_KEYS` (`src/config/loader.js:18`). This is correct and should be preserved. Adding `mcp` to `DROPPED_KEYS` would change the prefix to something else and break the `MCP_<SERVER>_<FIELD>` convention.

### Decision 2: Fix the stdio `env` nested-object bug in `syncEnv()` record matching
The bug is in `syncEnv()`'s record-pattern matching. When an env var like `MCP_LOCALFS_ENV_API_KEY` is processed, the suffix after the `MCP_` prefix is `LOCALFS_ENV_API_KEY`. The code splits on `_`, takes `parts[0]` (`localfs`) as the dynamic key, and then matches the remaining parts (`env_api_key`) against sub-path templates. Because `env` is itself a nested record, the fallback lowercases all remaining segments and joins with dots, producing `mcp.localfs.env.api.key` — a nested object that the `.strict()` schema rejects.

The fix: when the remaining sub-path resolves to a record field (like `env`), the value must be materialized as a flat `string -> string` record. The cleanest approach is to detect when the resolved sub-path template corresponds to a record field and treat the remaining segments as a single flat key rather than a nested path.

### Decision 3: Add example servers to config.yaml
Add a `stdio` server (e.g. `local-fs`) and an `http` server (e.g. `docs`) to `config.yaml`, alphabetically ordered between `memory` and `nosql`. These serve as documentation and as a validation reference for the schema.

## Risks / Trade-offs

- [Risk] The record-pattern matching fix could regress other record-based config (e.g. `vector.projects`). → Mitigation: add targeted tests for `MCP_*` materialization and run the full test suite.
- [Risk] Server names with hyphens (e.g. `local-fs`) produce env vars like `MCP_LOCAL_FS_*`. → Mitigation: document the convention; the dynamic key is lowercased from the first segment.

## Migration Plan

No migration required — this is additive config surface and a bug fix. Rollback is reverting the `config.yaml` addition and the `syncEnv()` fix.

## Open Questions

None.
