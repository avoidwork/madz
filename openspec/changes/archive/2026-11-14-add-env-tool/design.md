## Context

See proposal.md - Why. The harness uses LangChain's `@langchain/core/tools` for all assistant tools. Tools are registered in `src/tools/index.js` via `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `TOOLS`, and `buildToolConfig()`. The `env:read` permission scope is already declared in `src/skills/types.js` and `config.yaml` but is unused by any tool.

## Goals / Non-Goals

**Goals:**
- Add an `env` tool that reads environment variables from `process.env`.
- Follow the `src/tools/git/index.js` export pattern (tool instance export, not a factory).
- Register the tool in `src/tools/index.js` with the `env:read` permission scope.
- Validate input against a Zod schema.
- Never leak env values into logs.

**Non-Goals:**
- No sandbox config changes (the `env:read` scope already exists).
- No env var mutation/writing — the tool is read-only.
- No secret redaction of individual values beyond not logging them.

## Decisions

1. **Tool-name export (not factory).** Follow `src/tools/git/index.js`: `export const env = tool((input, options = {}) => envImpl(input, options), { name: "env", description, schema })`. The `createJsonTool()`/`createApiTool()` factory pattern is the WRONG template here — those tools need runtime config injection, which `env` does not. `envImpl` is exported for testing.

2. **Zod schema.** `z.object({ name: z.string().optional(), all: z.boolean().optional() })`. When `name` is provided, read that single variable; when `all` is true, return the full `process.env`. If neither is provided, default to returning the full environment (or require one — see Open Questions). The schema is non-strict so unknown keys are tolerated, matching the permissive style of other tools.

3. **`env:read` permission gating.** Add `env: ["env:read"]` to `TOOL_PERMISSIONS`. In `buildToolConfig()`, add a `case "env"` that pushes `TOOLS.env` only when `hasAllPerms` is true. This mirrors the `git`/`file`/`date` registration pattern.

4. **No secret leakage.** The tool never logs raw env values. It returns values only in the structured result. It uses no `console.log` (forbidden per AGENTS.md §1.1) and does not emit env values to the logger.

## Risks / Trade-offs

- [Risk: Env values may contain secrets] → **Mitigation**: The tool returns values only in the structured result and never logs them. The caller is responsible for handling sensitive values.
- [Risk: Returning the full environment could be large] → **Mitigation**: `all: true` is opt-in; the default single-variable read is bounded. The full env is returned as a plain object.
- [Risk: Input ambiguity when neither `name` nor `all` is provided] → **Mitigation**: Default to returning the full environment when no `name` is given, so the tool is always useful. (See Open Questions.)

## Migration Plan

No migration needed — this is a new tool with no existing behavior to preserve.

## Open Questions

- Should the tool require exactly one of `name` or `all`, or default to returning the full environment when neither is provided? The current design defaults to the full environment; this can be tightened later without changing the spec's observable behavior.
