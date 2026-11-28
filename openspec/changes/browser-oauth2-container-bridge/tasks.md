# Tasks

## 1. Config Schema

- [ ] 1.1 Add `callbackPort` and `flow` fields to `AuthProviderSchema` in `src/config/schemas/mcp.js` and verify the schema validates a config with the new fields
- [ ] 1.2 Add callback port / published-port configuration to `config.yaml` and verify the config loader materializes `MCP_<SERVER>_AUTHPROVIDER_*` env vars for the new fields

## 2. Provider Callback Server

- [ ] 2.1 Add an ephemeral HTTP callback server (via `node:http`) to `src/tools/mcp/authProvider.js` that binds to `127.0.0.1` on a dedicated port and verify it starts and listens
- [ ] 2.2 Implement the callback server's redirect handler to capture `code` + `state` from the query string, validate `state` against the provider-generated value, and write to a response store; verify state mismatch is rejected and state match is accepted
- [ ] 2.3 Enforce a timeout on the callback port and verify the callback server records a timeout when no redirect arrives
- [ ] 2.4 Change the `redirectUrl` getter to return `http://localhost:<port>/callback` and verify the SDK registers it

## 3. Provider Flow

- [ ] 3.1 Implement `prepareTokenRequest` to return a `URLSearchParams` with `grant_type=authorization_code`, `code`, `code_verifier`, and `redirect_uri`; verify `fetchToken` can exchange the code
- [ ] 3.2 In `redirectToAuthorization`, build the authorization URL and surface it via the `clarify`/interrupt bridge; verify the URL is surfaced and the flow pauses at the interrupt

## 4. Integration

- [ ] 4.1 Pass `connection.url` into `createAuthProvider` at the `src/tools/index.js` call site and verify the provider receives the MCP server URL

## 5. Silent Poller

- [ ] 5.1 Add a background poller in `src/tui/app.js` that watches the response store and resumes the graph with `Command({ resume: code })` when the code lands; verify the graph resumes silently
- [ ] 5.2 Handle timeout/abandonment in the poller so it gives up and resumes with a failure signal; verify the agent does not hang at the interrupt

## 6. Tests

- [ ] 6.1 Add unit tests in `tests/unit/tools/mcp/authProvider.test.js` covering callback server capture, state validation, and the response store; verify `npm run test` passes
- [ ] 6.2 Add integration test in `tests/integration/tools/mcp/authProvider.test.js` covering end-to-end browser flow against a mock authorization server; verify `npm run test` passes

## 7. Verification

- [ ] 7.1 Run `npm run test`, `npm run lint`, and `npm run coverage` and verify all pass

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
