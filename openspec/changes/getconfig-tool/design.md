## Context

The `loadConfig()` function in `src/config/loader.js` already loads, validates, caches, and returns the full project configuration. The `codeIndex` tool in `src/tools/codeIndex/index.js` demonstrates the exact pattern of importing and calling `loadConfig()`. The `getConfig` tool follows the same pattern but returns the config object directly instead of using it internally.

The tool registration system in `src/tools/index.js` uses a consistent pattern: `TOOL_PERMISSIONS` for sandbox gating, `TOOL_CLASSIFICATIONS` for agent-type routing, `ORCHESTRATOR_TOOLS` for orchestrator availability, and a `TOOLS` object map for runtime instances.

## Goals / Non-Goals

**Goals:**
- Create a `getConfig` tool that calls `loadConfig()` and returns the parsed JSON config
- Register the tool in the tool index with `filesystem:read` permission
- Make the tool available to the orchestrator and sub-agents with `codeIndex` access
- Provide unit tests covering success, error propagation, and schema validation

**Non-Goals:**
- No changes to `loadConfig()` or the config loading pipeline
- No new npm dependencies
- No integration tests
- No changes to how config is cached or validated

## Decisions

1. **Place tool in `src/tools/codeIndex/getConfig.js`** — co-locates with `codeIndex` since both depend on `loadConfig` and share the same access level. The issue specifies it should live alongside `codeIndex`.

2. **Use `@langchain/core/tools` `tool()` wrapper with empty Zod schema** — follows the exact same pattern as `codeIndex`. Empty schema (`z.object({})`) means no input parameters, and Zod will reject extraneous input automatically.

3. **Permission: `filesystem:read` only** — `getConfig` is read-only. It reads the config file (via `loadConfig` which uses `readFileSync`). No write permission needed.

4. **Classifications: `coding`, `debug`, `performance`** — matches `codeIndex` classifications. These are the agent types that need runtime config access.

5. **Error propagation** — if `loadConfig()` throws (missing config file, parse error, validation failure), the tool lets the error propagate. No try/catch wrapping — the harness handles tool errors.

## Risks / Trade-offs

- **Config caching** → `loadConfig()` caches after first call. The first call to `getConfig` may be slow (file I/O + parsing + validation), but subsequent calls return instantly. This is acceptable.
- **Sensitive data exposure** → Config may contain API keys. These are already managed by the config loader's security measures. The tool returns whatever `loadConfig` provides — no additional exposure.
- **No input validation surface** → The tool takes no user input, eliminating injection risk entirely.
