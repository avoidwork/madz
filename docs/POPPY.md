# Poppy (Personal Agent Protocol)

`madz` implements [Poppy (Personal Agent Protocol)](https://personalagentprotocol.org/docs/1.0/spec) so it can act as a personal agent that discovers companies, signs in on a user's behalf, and completes tasks across a company's APIs, agents, and web surfaces — all under a single, auditable session.

This document is the canonical reference for the Poppy integration. It covers every capability exposed by the `poppy` tool, the configuration documents involved, and end-to-end usage examples.

## Overview

Poppy is a protocol for personal agents to interact with companies. A company publishes a `poppy.json` document at `https://{domain}/.well-known/poppy.json` describing its agent, APIs, and web surfaces. A personal agent (like `madz`) discovers that document, establishes an identity, signs in on the user's behalf, and then calls the company's APIs and conversations while carrying a signed `Poppy-Session` header on every request.

`madz` exposes all of this through a single `poppy` tool that dispatches on an `action` enum. Each action maps to a module in `src/tools/poppy/`.

### The `poppy` tool

The `poppy` tool is registered in `src/tools/index.js` and gated behind the `network:outbound` permission. It is classified for the `orchestrator`, `research`, `coding`, and `security-audit` agent types and is available to the orchestrator.

| Action | Purpose |
| ------ | ------- |
| `api` | Call a company's OpenAPI and MCP APIs with Poppy headers |
| `browser` | Join a company's browser session |
| `conversation` | Start, send, read, and stream messages with a company's agent |
| `discover` | Fetch and validate a company's `poppy.json` |
| `extensions` | Parse and handle Poppy protocol extensions |
| `identity` | Manage the agent's client metadata document and signing keys |
| `oauth` | Direct Sign-In (authorization code + PKCE) and Device Sign-In, refresh rotation, revocation, DPoP |
| `security` | Enforce Poppy security considerations |
| `session` | Generate Poppy-Session JWTs and issue delegations |
| `tasks` | Fetch a company's excluded tasks, published skills, and feedback endpoint |
| `verify` | Verify incoming Poppy-Session JWTs, delegations, and access tokens |

## Configuration

### Company `poppy.json`

A company publishes its Poppy capabilities in a `poppy.json` document at `https://{domain}/.well-known/poppy.json`. The document is fetched over HTTPS and validated against the protocol's required fields.

```json
{
  "protocol_version": "1.0",
  "organization": {
    "name": "Example Corp",
    "domain": "example.com"
  },
  "agent": {
    "endpoint": "https://agent.example.com"
  },
  "apis": [
    {
      "type": "openapi",
      "description": "Customer records",
      "endpoint": "https://api.example.com/openapi.json"
    },
    {
      "type": "mcp",
      "description": "Internal tools",
      "endpoint": "https://mcp.example.com/mcp"
    }
  ],
  "web": {
    "browser_session_endpoint": "https://example.com/poppy/browser-session"
  },
  "tasks": {
    "endpoint": "https://example.com/poppy/tasks"
  },
  "extensions": {
    "links": {
      "version": "1.0",
      "endpoint": "https://example.com/poppy/links"
    }
  }
}
```

| Field | Description |
| ----- | ----------- |
| `protocol_version` | The Poppy protocol version the company supports. |
| `organization.name` | The company's display name. |
| `organization.domain` | The company's domain. Must match the host that served the document. |
| `agent.endpoint` | The company's agent conversation endpoint. |
| `apis[]` | The company's OpenAPI and MCP APIs. Each entry has a `type` (`openapi` or `mcp`), a `description`, and an `endpoint`. |
| `web.browser_session_endpoint` | The endpoint for joining the company's browser session. |
| `tasks.endpoint` | The endpoint for fetching task coverage. |
| `extensions` | Optional protocol extensions, keyed by name with a `version` and `endpoint`. |

### Agent client metadata document (CIMD)

`madz` publishes its own client metadata document at its `client_id` URL so companies can discover and verify it. The document is served with `token_endpoint_auth_method` set to `private_key_jwt`.

```json
{
  "client_id": "https://agent.example.com/poppy/client",
  "client_name": "madz",
  "logo_uri": "https://agent.example.com/logo.png",
  "jwks_uri": "https://agent.example.com/poppy/jwks",
  "redirect_uris": [
    "https://agent.example.com/poppy/callback"
  ],
  "token_endpoint_auth_method": "private_key_jwt"
}
```

| Field | Description |
| ----- | ----------- |
| `client_id` | The agent's identifier URL. Must equal the URL the document is fetched from. |
| `client_name` | The agent's display name. |
| `logo_uri` | Optional logo URL. |
| `jwks_uri` | The public JWK key set URL. Must be on the same domain as `client_id`. |
| `redirect_uris` | Valid redirect URIs. HTTPS on the same domain as `client_id`, or loopback URIs per RFC 8252 §7.3. |
| `token_endpoint_auth_method` | Must be `private_key_jwt`. |

**The CIMD does not need to be served by madz itself.** The document is static, and `jwks_uri` serves only public keys — the private signing keys never leave madz. So the `client_id` and `jwks_uri` URLs can be hosted by any third-party static host (a CDN, GitHub Pages, S3, a reverse proxy) on a domain madz controls. madz only needs to hold the private keys and sign locally; it does not need to run a persistent server to publish its identity. The only requirement is that both URLs are HTTPS and on the same domain, and that the public JWKS is kept in sync with madz's current keys (companies cache the key set, so a removed key stops being accepted once their caches expire).

## Capabilities

### Discovery

The `discover` action fetches and validates a company's `poppy.json` at `https://{domain}/.well-known/poppy.json`. It follows redirects (each must be HTTPS), requires the final path to be exactly `/.well-known/poppy.json` with no query string, validates the document against the required fields, checks that `organization.domain` matches the serving host, and validates that all URLs are HTTPS and not loopback/private/link-local addresses. Results are cached per-domain with a TTL.

```json
{ "action": "discover", "domain": "example.com" }
```

### Agent Identity

The `identity` action manages the agent's client metadata document and signing keys. It serves the CIMD at the `client_id` URL, publishes the public JWK key set at `jwks_uri`, validates `redirect_uris`, and signs RFC 7523 client assertions with ES256 or PS384.

```json
{ "action": "identity", "op": "generate", "clientId": "https://agent.example.com/poppy/client", "clientName": "madz", "jwksUri": "https://agent.example.com/poppy/jwks", "redirectUris": ["https://agent.example.com/poppy/callback"], "alg": "ES256" }
```

### Session Signing

The `session` action generates a Poppy-Session JWT per request with `typ: poppy-session+jwt` and `alg: ES256`, carrying `iss`, `aud`, `sid`, `sub`, optional `agent_id`, `htm`/`htu`, `iat`, `jti`, and `ath` (when an access token is present). It signs with a delegated key, carries the delegation in the `poppy_dlg` protected header, and emits the `Poppy-Version` and `Poppy-Extensions` headers alongside the session header.

```json
{ "action": "session", "op": "sign", "userId": "user-123", "method": "GET", "url": "https://api.example.com/records", "agentId": "madz" }
```

### OAuth Sign-In

The `oauth` action performs Direct Sign-In (authorization code + PKCE) and Device Sign-In (device authorization grant), including metadata discovery, refresh token rotation and revocation, and DPoP support. Secrets (access tokens, refresh tokens, authorization codes, PKCE verifiers) are kept out of model context.

```json
{ "action": "oauth", "op": "authorize", "issuer": "https://example.com", "redirectUri": "https://agent.example.com/poppy/callback", "scope": "openid profile", "state": "csrf-state" }
```

### Session Verification

The `verify` action verifies incoming Poppy-Session JWTs, delegations, and access tokens on company-side endpoints. It fetches the client metadata from `iss` without following redirects, fetches public keys from `jwks_uri`, verifies the delegation and signature, validates claims (`typ`, `aud`, `htm`/`htu`, `iat`), checks access token binding (`ath`), and looks up the session by client, `sid`, and user.

```json
{ "action": "verify", "session": "<poppy-session-jwt>" }
```

### API Integration

The `api` action calls a company's OpenAPI and MCP APIs with the Poppy-Session header and access tokens. It selects the right API for a task by matching the task against the API's type and description, enforces scopes on company-side endpoints, maps access token errors per Poppy spec section 7, and supports idempotency keys for safe retries.

```json
{ "action": "api", "op": "call", "task": "list customer records", "apiType": "openapi", "endpoint": "https://api.example.com/openapi.json", "path": "/records" }
```

### Conversations

The `conversation` action starts, sends, reads, and streams messages with a company's agent. It supports starting a conversation (`POST {endpoint}`), sending messages (`POST {endpoint}/{id}/messages`), reading events (`GET {endpoint}/{id}/events`), streaming via SSE, handoff to a person, and direct conversations.

```json
{ "action": "conversation", "op": "start", "endpoint": "https://agent.example.com" }
```

### Browser Join

The `browser` action joins a company's browser session via its `browser_session_endpoint`. It loads the endpoint in the agent's browser, reads the one-time code from the agent's own browser page, authorizes it via `POST {browser_session_endpoint}/authorize`, and submits the form to set the session cookie. The access token is never sent through the browser.

```json
{ "action": "browser", "op": "join", "endpoint": "https://example.com/poppy/browser-session" }
```

### Task Coverage

The `tasks` action fetches a company's excluded tasks, published agent skills, and feedback endpoint. It matches a user's task against exclusions and alternatives, verifies skill artifact digests, and reports tasks it couldn't do.

```json
{ "action": "tasks", "op": "fetch", "endpoint": "https://example.com/poppy/tasks" }
```

### Extensions

The `extensions` action parses the `extensions` field from `poppy.json`, builds the `Poppy-Extensions` header as an RFC 9651 List of Strings, handles `extension_required` responses, and validates extension content. The core extensions are `browser-control`, `disclosures`, `links`, `mediated-sign-in`, `operations`, and `ucp`.

```json
{ "action": "extensions", "op": "parse", "poppyJson": { "extensions": { "links": { "version": "1.0" } } } }
```

### Security

The `security` action enforces Poppy's security considerations: keeping secrets out of model context (via a secrets vault and redaction), treating company content as data rather than instructions, validating audiences against the verified company identifier, isolating and rotating delegated keys, supporting blind signing (RFC 9474), and handling sign-in risks.

```json
{ "action": "security", "op": "store", "key": "example.com.access_token", "value": "<secret>" }
```

## Usage Examples

### Discover a company

```json
{ "action": "discover", "domain": "example.com" }
```

The tool fetches `https://example.com/.well-known/poppy.json`, validates it, and returns the normalized document describing the company's agent, APIs, and web surfaces.

### Sign in (Direct Sign-In)

```json
{ "action": "oauth", "op": "authorize", "issuer": "https://example.com", "redirectUri": "https://agent.example.com/poppy/callback", "scope": "openid profile", "state": "csrf-state" }
```

The tool builds the authorization URL with PKCE, and after the user approves, exchanges the code at the token endpoint for access and refresh tokens. The tokens are stored in the secrets vault and never exposed to the model.

### Complete a task

```json
{ "action": "api", "op": "call", "task": "list customer records", "apiType": "openapi", "endpoint": "https://api.example.com/openapi.json", "path": "/records" }
```

The tool selects the matching OpenAPI API, calls it with the Poppy-Session header and access token, and returns the result.

## Protocol Reference

The authoritative specification is the [Poppy (Personal Agent Protocol) spec](https://personalagentprotocol.org/docs/1.0/spec). Each capability above corresponds to a section of that spec; cross-check behavior against the spec and the source in `src/tools/poppy/`.
