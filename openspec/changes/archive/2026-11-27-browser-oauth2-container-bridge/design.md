# Design

## Context

See proposal.md - Why. The MCP OAuth provider (`src/tools/mcp/authProvider.js`) currently returns `redirectUrl = undefined`, so the MCP SDK's `auth()` orchestrator (`@modelcontextprotocol/sdk/dist/esm/client/auth.js`) treats it as non-interactive and never calls `redirectToAuthorization`. The SDK's `authInternal` flow requires `provider.redirectUrl` to be truthy to enter the interactive authorization path; without it, `fetchToken` falls back to `authorization_code` because `prepareTokenRequest` is not implemented. The provider's auth logic is effectively unreachable.

## Goals / Non-Goals

**Goals:**
- Implement a browser-based authorization-code + PKCE flow that works when madz runs in a container and the browser runs on the host.
- Bridge the container to the host browser via a callback server + interrupt + silent poller.
- Make the provider's auth logic reachable through the SDK's own `auth()` flow.

**Non-Goals:**
- The device flow (RFC 8628) — tracked separately in issue #2144.
- No new npm packages.

## Decisions

### Decision 1: Callback server binds to localhost only

The callback server binds to `127.0.0.1` on a dedicated port, not to all interfaces. This avoids exposing the callback port to the network (security consideration from the issue).

**Alternatives considered:** Binding to `0.0.0.0` — rejected because it exposes the callback port to the network.

### Decision 2: The interrupt is the pause gate, not the data channel

The agent's OAuth flow runs inside a LangGraph graph node, so it calls `clarify`/`interrupt()`. This pauses the agent until the user completes the browser flow. The authorization code travels through the callback server's response store, not through the interrupt value. The agent reads the code from the response store after the interrupt resumes.

**Alternatives considered:** Passing the code through the interrupt resume value directly — rejected because the code arrives asynchronously via the callback server, not from user input.

### Decision 3: The silent poller resumes the graph

A background poller (in the TUI layer, outside the graph) watches the response store and resumes the graph with `Command({ resume: code })` when the code lands. This mirrors the existing Copilot auth poll pattern at `src/tui/app.js` line ~251. The poller handles timeout/abandonment by giving up and resuming with a failure signal.

**Alternatives considered:** Requiring the user to press Enter after the browser flow — rejected because the silent poller removes the manual step entirely.

### Decision 4: `prepareTokenRequest` for the code exchange

Implement `prepareTokenRequest` so the SDK's `fetchToken` exchanges the authorization code with the code verifier and redirect URI. It returns a `URLSearchParams` with `grant_type=authorization_code`, `code`, `code_verifier`, and `redirect_uri`.

**Alternatives considered:** Relying on the SDK's default `authorization_code` fallback — rejected because it does not include the PKCE code verifier or redirect URI.

### Decision 5: Config for callback port and flow selection

Update `AuthProviderSchema` in `src/config/schemas/mcp.js` to support the callback port and flow selection. The schema is `.strict()`, so new fields must be added explicitly. The `MCP_<SERVER>_AUTHPROVIDER_*` env var materialization in the config loader must continue to work.

**Alternatives considered:** Hardcoding the callback port — rejected because the port must be configurable for container port publishing.

## Risks / Trade-offs

- [Callback port not published to host] → When the port is not published, the browser flow cannot receive the redirect; the fallback is the device flow (RFC 8628), tracked separately. The config allows the user to control this.
- [State mismatch (CSRF)] → The callback server validates `state` against the value the provider generated and rejects mismatches.
- [Callback timeout / user abandons flow] → The callback server enforces a timeout on the callback port; the poller gives up and resumes with a failure signal so the agent does not hang.
- [`.strict()` schema rejects unknown fields] → New fields are added explicitly to `AuthProviderSchema`; env var materialization is verified.

## Migration Plan

No breaking changes. The new browser flow is additive; existing non-interactive behavior is preserved when the callback flow is not configured. Rollback is a revert of the feature branch.

## Open Questions

None.
