# Design

## Context

See proposal.md - Why. The `poppy` tool in `src/tools/poppy/index.js` dispatches on an `action` enum via an `ACTIONS` registry, importing action modules as namespaces each exporting an `execute` function. Existing action modules (`discovery.js`, `identity.js`, `session.js`, `oauth.js`, `verify.js`) follow the sql/nosql driver/engine pattern. `common.js` exports `fetchJson`. `discovery.js` exports `PoppyDocumentSchema` and `validateUrl`. `@langchain/mcp-adapters` and `jose` are already dependencies.

## Goals / Non-Goals

**Goals:**
- Add a new `api` action module that calls OpenAPI and MCP APIs with Poppy session headers and access tokens.
- Select the right API for a task from `poppy.json`.
- Enforce scopes on company-side endpoints and map access token errors per section 7.
- Support idempotency keys.

**Non-Goals:**
- Modifying existing actions beyond registering `api`.
- Re-expanding the tool `description`.
- Implementing a raw Streamable HTTP MCP client.

## Decisions

- **New `api` action module at `src/tools/poppy/api.js`.** Follows the existing action-module convention: exports `execute(input, options)` that dispatches on an `op` field via a `switch`, with internal handlers named without an `Action` suffix. Rationale: mirrors `oauth.js`/`session.js`.
- **Reuse `fetchJson` from `./common.js`** for all HTTP calls rather than adding a new fetch wrapper. Rationale: DRY, consistent timeout/error normalization.
- **Reuse `validateUrl` and `PoppyDocumentSchema` from `discovery.js`** for URL validation and poppy.json parsing. Rationale: DRY, consistent security posture (HTTPS-only, non-private).
- **Use `@langchain/mcp-adapters`** for MCP server calls over Streamable HTTP transport. Rationale: already a dependency; avoids a bespoke Streamable HTTP client.
- **Use `jose`** for any signing needs. Rationale: already a dependency.
- **Register `api` in `ACTIONS` and add `"api"` to the action enum** in `poppySchema`, plus api-specific fields with `superRefine` field-validity rules. Rationale: consistent with existing actions.
- **Error mapping per section 7** returns `{ ok: false, error, code }` with the Poppy error code and mapped HTTP status.

## Risks / Trade-offs

- [MCP transport negotiation complexity] → Delegate to `@langchain/mcp-adapters`; keep the api module thin.
- [Ambiguous API selection] → Match on type and description; return a clear error when no match.
- [Token leakage in URLs] → Never place tokens in URLs; always use headers.
- [Schema field collisions with existing actions] → Add api fields with distinct names and `superRefine` rules.
