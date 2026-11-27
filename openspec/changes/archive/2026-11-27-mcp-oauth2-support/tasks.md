# Tasks

## 1. Schema Extension

- [x] 1.1 Add optional `headers` (`z.record(z.string(), z.string())`) and `authProvider` (`z.unknown()`) fields to the `http` and `sse` variants of `McpServerSchema` in `src/config/schemas/mcp.js`, leaving the `stdio` variant unchanged. Verify the schema accepts `headers`/`authProvider` on http/sse and rejects them on stdio via `node --test`.

## 2. Tests

- [x] 2.1 Add unit tests to `tests/unit/config/schemas/mcp.test.js` covering: http accepts `headers`/`authProvider`, sse accepts `headers`/`authProvider`, stdio rejects `headers`, and `headers` with a non-string value is rejected. Verify via `node --test tests/unit/config/schemas/mcp.test.js`.
- [x] 2.2 Add an integration test in `tests/integration/` confirming the MCP adapter receives `headers`/`authProvider` from an http/sse server config (mock the adapter; no real network). Verify via `node --test`.

## 3. Documentation

- [x] 3.1 Document the new `headers` and `authProvider` config fields for http/sse MCP servers in the MCP config reference, noting credentials should come from env vars. Verify the documented fields match the schema.

## 4. Verification

- [x] 4.1 Run `npm run test`, `npm run lint`, and `npm run coverage` and confirm all pass.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
