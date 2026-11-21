# Proposal

## Why

Poppy lets a personal agent get work done through a company's APIs. The agent lists `openapi` and `mcp` APIs in `poppy.json` and calls them with the session header and access tokens. This is the primary channel for getting tasks done and builds on the previously merged Poppy features (discovery, agent identity, session signing, OAuth, session verification).

## What Changes

- Add a new `api` action to the `poppy` tool that calls a company's OpenAPI and MCP APIs with the `Poppy-Session` header, `Poppy-Version`, `Poppy-Extensions`, and access token as needed.
- Discover `openapi` and `mcp` entries from `poppy.json` and select the right API for a task.
- Call remote MCP servers over Streamable HTTP transport (MCP 2025-06-18 or later) with the session header, requesting a token with `resource` set to the MCP server's URL.
- Handle access token errors per Poppy spec section 7: `invalid_token` (401), `insufficient_scope` (403), `invalid_session` (400), `session_ended` (400), `version_unsupported` (400), `extension_required` (403).
- Enforce scopes on company-side API endpoints (when madz acts as a company).
- Support idempotency keys for safe retries.

## Capabilities

### New Capabilities
- `poppy-api-integration`: Calling a company's OpenAPI and MCP APIs with the Poppy-Session header and access tokens, selecting the right API for a task, enforcing scopes on company-side endpoints, and handling access token errors per Poppy spec section 7.

### Modified Capabilities
<!-- No existing capability requirements change. -->

## Impact

- `src/tools/poppy/api.js` (new) — the `api` action module.
- `src/tools/poppy/index.js` (modified) — register `api` in `ACTIONS`, add `"api"` to the action enum, add api fields to `poppySchema`.
- `tests/unit/tools/poppy/api.test.js` (new) — unit tests.
- `tests/integration/tools/poppy/api.test.js` (new) — integration tests.
- Dependencies: `@langchain/mcp-adapters` (already present), `jose` (already present).

## Non-goals

- Modifying the existing `discover`, `identity`, `session`, `oauth`, or `verify` actions beyond registering the new `api` action.
- Re-expanding the `poppy` tool's `description` (it stays slimmed).
- Implementing a raw Streamable HTTP MCP client (uses `@langchain/mcp-adapters`).
