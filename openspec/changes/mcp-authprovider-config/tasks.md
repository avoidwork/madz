# Tasks

## 1. Dependency Setup

- [x] 1.1 Add `@langchain/auth@^0.1.0` to `package.json` dependencies and verify `npm install` succeeds and the package resolves

## 2. Schema Typing

- [x] 2.1 Replace `authProvider: z.unknown().optional()` with a typed Zod object schema on the `http` and `sse` variants in `src/config/schemas/mcp.js` and verify `npm run test` passes for `tests/unit/config/schemas/mcp.test.js`
- [x] 2.2 Verify `buildReverseMap`/`syncEnv` in `src/config/loader.js` registers the new `authProvider` sub-fields so `MCP_<SERVER>_AUTHPROVIDER_*` env vars materialize, and add a `syncEnv` unit test in `tests/unit/config/loader.test.js`

## 3. Built-in OAuth Provider

- [x] 3.1 Create a built-in `OAuthClientProvider` implementation (e.g. `src/tools/mcp/authProvider.js`) that implements the MCP `OAuthClientProvider` interface and delegates token acquisition to `@langchain/auth`'s `Client`, and verify it satisfies the interface
- [x] 3.2 Add unit tests for the built-in provider (mocking `@langchain/auth`'s `Client`) and verify they pass

## 4. Wiring

- [x] 4.1 Confirm `src/tools/index.js` passes the resolved `authProvider` through to `MCPAdapter` unchanged (only `agents` stripped) and verify existing MCP tests pass

## 5. Verification

- [x] 5.1 Run `npm run test`, `npm run lint`, and `npm run coverage` and verify all pass with no regressions

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
