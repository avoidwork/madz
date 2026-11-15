# Proposal

## Why

The harness has no built-in way to read environment variables. The `env:read` permission scope is already declared in the sandbox config (`src/skills/types.js` and `config.yaml`) but no tool currently uses it. Without an `env` tool, the assistant cannot inspect runtime configuration, secrets, or deployment settings exposed via the environment.

## What Changes

- Add an `env` tool at `src/tools/env/index.js` that reads environment variables from `process.env`.
- The tool follows the `src/tools/git/index.js` export pattern: the export is the tool instance itself (`export const env = tool(...)`), not a factory. `envImpl` is the implementation function.
- Register `env` in `src/tools/index.js`: add to the `TOOLS` map, `TOOL_PERMISSIONS` (requires `env:read`), `TOOL_CLASSIFICATIONS`, and a `case "env"` in `buildToolConfig()`.
- Validate all input against a Zod schema.
- Never leak env values into logs (per AGENTS.md §1.2 — strip PII/secrets before logging).

## Capabilities

### New Capabilities
- `env-tool`: Adds an `env` tool that reads environment variables from `process.env`, gated by the `env:read` permission scope, with Zod input validation and no secret leakage into logs.

### Modified Capabilities
- None

## Impact

- `src/tools/env/index.js` — new file: `envImpl` + `env` tool.
- `src/tools/index.js` — register `env` in `TOOLS`, `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, and `buildToolConfig()`.
- `tests/unit/tools/env.test.js` — new test file.

## Non-goals

- No sandbox config changes (the `env:read` scope already exists).
- No env var mutation/writing — the tool is read-only.
- No secret redaction of individual values beyond not logging them (the tool returns values as-is; the caller is responsible for handling them).
