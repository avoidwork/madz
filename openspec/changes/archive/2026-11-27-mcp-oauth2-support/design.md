# Design

## Context

See proposal.md - Why. The MCP server config schema (`src/config/schemas/mcp.js`) is a `z.discriminatedUnion` keyed on `transport` (stdio/http/sse), each variant `.strict()`. The `http` and `sse` variants currently permit only `url` and `agents`. The adapter construction in `src/tools/index.js` (lines 635-639) strips only the `agents` field via `const { agents: _agents, ...connection } = serverConfig` and forwards the remainder to `MCPAdapter`. `@langchain/mcp-adapters` v2 already supports OAuth2 for `http`/`sse` via `headers` and `authProvider`.

## Goals / Non-Goals

**Goals:**
- Expose optional `headers` and `authProvider` on the `http`/`sse` schema variants so OAuth2-protected servers can be configured.
- Ensure the existing adapter wiring forwards these fields unchanged.
- Add unit and integration coverage, and document the fields.

**Non-Goals:**
- No new transports.
- No OAuth2 token refresh logic in madz (the library owns it).
- No change to the `stdio` variant.
- No change to `src/tools/index.js` wiring beyond verification.

## Decisions

- **Schema-only change.** The capability already exists in the dependency; exposing it in the config surface is the minimal, YAGNI-compliant change. No new abstractions or wrappers.
- **`authProvider` is opaque to madz.** Validating its internal shape would duplicate the library's type and risk rejecting valid providers (which may contain functions). madz validates only that the field is present and passes it through. Use a permissive schema (`z.unknown().optional()`) so the value flows through untouched.
- **`headers` is a flat `string -> string` record.** Mirrors the existing `env` record on the `stdio` variant and matches the library's `Record<string,string>` type. A nested object is rejected.
- **Credentials via env vars.** Per AGENTS.md §1.2, no plaintext secrets in config files. `headers`/`authProvider` values should reference env vars; the config system already supports env-var materialization for MCP fields.

## Risks / Trade-offs

- [authProvider may contain functions] → Use `z.unknown()` so zod does not coerce or reject provider objects; the library validates the shape at runtime.
- [Adapter strict schema rejects unknown fields] → Only `headers`/`authProvider` are added; these match the library's connection types, so they pass through.
- [Coverage gate] → New schema branches and tests must be covered; add unit tests for both accept and reject paths.
