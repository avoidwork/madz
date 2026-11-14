# Design

## Context

See proposal.md - Why. The `env:read` permission scope is declared in `src/skills/types.js` but has no consumer. The `env` tool follows the established factory pattern used by `json`, `yaml`, `data`, and `webhook` tools in `src/tools/index.js`. The reference implementation is `src/tools/json/index.js` (Zod schema + `tool()` wrapper + `createJsonTool()` factory).

## Goals / Non-Goals

**Goals:**
- Provide a permission-gated `env` tool that reads from `process.env`.
- Follow the existing factory pattern so registration is consistent with sibling tools.
- Validate all input against a Zod schema.
- Never leak env values into logs (AGENTS.md 1.2).

**Non-Goals:**
- No new dependencies (Node built-in `process.env`).
- No changes to the sandbox permission schema (`env:read` already exists).
- No changes to `getConfig` or other tools.

## Decisions

### Decision 1: Factory pattern (`createEnvTool()`)
The tool is exposed as a factory function `createEnvTool()` that returns a LangChain Tool instance, matching `createJsonTool()`, `createYamlTool()`, `createDataTool()`, and `createWebhookTool()`. This means it must be added to the factory-based `case` group in `buildToolConfig()` (alongside `json`, `yaml`, `data`, `webhook`) which calls `TOOLS[toolName]()`.

**Alternatives considered:**
- A plain exported tool instance (like `date`, `clarify`). Rejected because the sibling data-manipulation tools use the factory pattern, and the issue explicitly requests following the `json` pattern.

### Decision 2: Input schema
The tool accepts a variable name (string) and optionally a list of variable names. The schema validates input before reading. This mirrors the `json` tool's approach of validating all input via `z.object()`.

**Alternatives considered:**
- Accepting a single string only. Rejected — supporting a list lets the agent read multiple variables in one call, which is more useful and still validates cleanly.

### Decision 3: Permission gating
The tool requires exactly `["env:read"]`. Registration in `buildToolConfig()` gates on `hasAllPerms` (all required permissions in the enabled set). This matches the existing permission model where a tool registers only when ALL its required permissions are enabled.

**Alternatives considered:**
- No permission (always registered). Rejected — the issue explicitly requires `env:read` gating, and the scope exists precisely to gate env access.

### Decision 4: No logging of values
The tool returns values in the structured result but performs no logging of the values themselves. This satisfies AGENTS.md 1.2 ("Strip PII before logging"). The tool does not call the logger with env values.

## Risks / Trade-offs

- [Env values may be sensitive] → The tool returns values to the caller (the agent) but never logs them. The `env:read` permission gates access. Callers are responsible for not echoing secrets into conversation; the tool itself does not log.
- [Cross-test pollution from env vars] → Tests set and clean up env vars in `beforeEach`/`afterEach` to avoid leaking state between tests.
- [Empty variable name edge case] → The Zod schema rejects empty strings, returning a structured `{ ok: false, error }`.
