# Proposal

## Why

The `env:read` permission scope is already declared in `src/skills/types.js` (the `PermissionSchema` enum) but no tool wires it. `getConfig` reads harness config, not arbitrary environment variables, so the agent cannot inspect environment variables without shelling out through `process`. This change adds a dedicated, permission-gated `env` tool that reads from `process.env`.

## What Changes

- Add a new `env` tool at `src/tools/env/index.js` exposing a `createEnvTool()` factory (Zod schema + `tool()` wrapper), following the `src/tools/json/index.js` pattern.
- The tool reads from `process.env` and returns a structured `{ ok, data, error }` result.
- Register the tool in `src/tools/index.js`: add to the `TOOLS` map, `TOOL_PERMISSIONS` (requires `env:read`), `TOOL_CLASSIFICATIONS`, and a `case "env"` in `buildToolConfig()`.
- Validate all input against a Zod schema.
- Never leak env values into logs (AGENTS.md 1.2).

## Capabilities

### New Capabilities
- `env-tool`: The `env` tool that reads environment variables from `process.env`, gated by the `env:read` permission scope.

### Modified Capabilities
- None.

## Impact

**Modified files:**
- `src/tools/env/index.js` — new tool file (Zod schema + `createEnvTool()` factory).
- `src/tools/index.js` — register `env` in `TOOLS`, `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, and `buildToolConfig()`.
- `tests/unit/tools/env.test.js` — new unit tests.
- `tests/integration/tools/env.test.js` — new integration test.

**Affected subsystems:**
- Tool registry and permission gating (`src/tools/index.js`).
- Sandbox permission model (`env:read` scope now has a consumer).

## Non-goals

- No new dependencies — Node built-in `process.env`.
- No changes to the sandbox permission schema (`env:read` already exists).
- No changes to `getConfig` or other tools.
