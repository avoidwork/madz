# Tasks

## 1. Config Surface

- [x] 1.1 Add a root-level `mcp:` section to `config.yaml` with example `stdio` and `http`/`sse` server entries matching `McpSchema`, alphabetically ordered between `memory` and `nosql`. Verify `npm run test` passes and the config loads without schema errors.

## 2. Env-Var Materialization Fix

- [x] 2.1 Fix `syncEnv()` in `src/config/loader.js` so `MCP_<SERVER>_ENV_<KEY>` materializes as a flat `string -> string` record under `mcp.<server>.env`, not a nested object. Verify with a targeted test that `MCP_LOCALFS_ENV_API_KEY` produces `mcp["local-fs"].env.API_KEY = "secret"` and the config passes `ConfigSchema` validation.
- [x] 2.2 Verify `MCP_<SERVER>_<FIELD>` materialization works for `http`/`sse` servers (e.g. `MCP_DOCS_TRANSPORT`, `MCP_DOCS_URL`). Verify with a targeted test that the resulting config passes `ConfigSchema` validation.

## 3. Tests

- [x] 3.1 Expand `tests/unit/config/schemas/mcp.test.js` to cover all three transport variants, missing required fields, and the flat `env` record regression. Verify `npm run test` passes.
- [x] 3.2 Add integration tests in `tests/unit/config_loader.test.js` for `MCP_*` env-var materialization including the flat `env` record. Verify `npm run test` passes.

## 4. Verification

- [ ] 4.1 Run `npm run test`, `npm run lint`, and `npm run coverage` and confirm all pass with no regressions.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
