# Proposal

## Why

The MCP OAuth2 provider (`src/tools/mcp/authProvider.js`) returns `redirectUrl = undefined`, so the MCP SDK's `auth()` orchestrator treats it as non-interactive and never calls `redirectToAuthorization`; `fetchToken` falls back to `authorization_code` because `prepareTokenRequest` is not implemented. The provider's auth logic is effectively unreachable through the SDK's own flow. When madz runs inside a Docker container, the host OS browser opener spawned by `openUrl` cannot reach a container display, and a host-browser redirect to `localhost:<port>` lands on the host, not the container. This change adds a browser-based OAuth2 authorization-code + PKCE flow with a container/host bridge so the flow works when madz runs in a container and the user's browser runs on the host.

## What Changes

- Add an ephemeral HTTP callback server (via `node:http`) to the MCP OAuth provider that binds to `127.0.0.1` on a dedicated port, captures `code` + `state` from the redirect, validates `state` (CSRF protection), and writes to a response store.
- Change the provider's `redirectUrl` getter to return `http://localhost:<port>/callback` so the SDK registers it and the AS redirects there.
- Implement `prepareTokenRequest` so `fetchToken` exchanges the authorization code with the code verifier and redirect URI.
- Surface the authorization URL via the `clarify`/interrupt bridge in `redirectToAuthorization`, pausing the agent until the browser flow completes.
- Add a silent poller (in the TUI layer) that watches the response store and resumes the graph with `Command({ resume: code })` when the code lands, with timeout/abandonment handling.
- Pass the MCP server URL into `createAuthProvider` at the `src/tools/index.js` call site.
- Update `AuthProviderSchema` in `src/config/schemas/mcp.js` to support the callback port and flow selection, and add the callback port / published-port configuration to `config.yaml`.
- Add unit and integration tests for the callback server, state validation, response store, and end-to-end browser flow.

## Capabilities

### New Capabilities

- `mcp-oauth-browser-flow`: The browser-based OAuth2 authorization-code + PKCE flow for MCP servers, including the callback server, the container/host bridge, the silent poller, and the timeout/abandonment handling.

### Modified Capabilities

- `mcp-auth-provider`: The built-in OAuth client provider gains a browser-based authorization-code flow with a callback server and `prepareTokenRequest`, replacing the current non-interactive `redirectUrl = undefined` behavior.

## Impact

- **Code**: `src/tools/mcp/authProvider.js`, `src/tui/app.js`, `src/tools/index.js`, `src/config/schemas/mcp.js`, `config.yaml`.
- **Tests**: `tests/unit/tools/mcp/authProvider.test.js`, `tests/integration/tools/mcp/authProvider.test.js`.
- **Dependencies**: No new npm packages — reuses `node:http` and the existing `openUrl` helper.
- **Config**: New `authProvider` fields for callback port and flow selection; `MCP_<SERVER>_AUTHPROVIDER_*` env var materialization must continue to work.

## Non-goals

- The device flow (RFC 8628) is out of scope — tracked separately in issue #2144.
- No new npm packages are introduced.
- The callback server binds to localhost only; it does not expose the callback port to the network.
