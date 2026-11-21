# Proposal

## Why

Poppy uses standard OAuth for account access. A personal agent must support Direct Sign-In (the preferred flow) and Device Sign-In to obtain access tokens and refresh tokens, which are then used with the session header on signed-in requests. This builds on the already-merged Poppy features: discovery (#2002), agent identity (#2003), and session signing (#2004).

## What Changes

- Add a `poppy` OAuth module at `src/tools/poppy/oauth.js` that reads the company's OAuth Authorization Server Metadata (RFC 8414) and protected resource metadata (RFC 9728) to find the issuer, token, authorization, device authorization, and revocation endpoints.
- Implement Direct Sign-In: build the authorization URL with `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge`, `code_challenge_method=S256`; validate `iss` on the redirect; exchange the code at the token endpoint with a client assertion.
- Implement Device Sign-In: request a device code, show the user the verification URI and code, poll the token endpoint until approved or expired.
- Handle refresh tokens (RFC 6749 §6) with rotation, and revocation (RFC 7009).
- Support DPoP (RFC 9449) proofs when the issuer's metadata lists `dpop_signing_alg_values_supported`.
- Enforce `prompt=consent` for cross-device Direct Sign-In, and RFC 10027 best practices for Device Sign-In.
- Wire the oauth module into the `poppy` tool's ACTIONS registry in `src/tools/poppy/index.js` as a new `oauth` action.
- Add unit tests under `tests/unit/tools/poppy/oauth.test.js` and an integration test under `tests/integration/tools/poppy/oauth.test.js`.

## Capabilities

### New Capabilities
- `poppy-oauth-signin`: obtain account access tokens and refresh tokens via Poppy OAuth Direct Sign-In (authorization code + PKCE) and Device Sign-In (device authorization grant), including metadata discovery, refresh token rotation and revocation, and DPoP support.

### Modified Capabilities
<!-- No existing spec-level behavior changes. -->

## Impact

- `src/tools/poppy/oauth.js` — new OAuth module (metadata discovery, direct sign-in, device sign-in, refresh, revoke, DPoP).
- `src/tools/poppy/index.js` — wire the `oauth` action into ACTIONS, `poppySchema` enum, and `superRefine`; update tool description.
- `tests/unit/tools/poppy/oauth.test.js` — unit tests.
- `tests/integration/tools/poppy/oauth.test.js` — integration test against a mock OAuth server.
- `jose` (v6.2.18) — already a dependency, used for client assertion signing and DPoP proofs.

## Non-goals

- No persistence of tokens beyond what the module returns (token storage is out of scope).
- No changes to other tools or the existing discovery/identity/session modules beyond wiring the new action.
- No HTTP transport layer beyond the OAuth endpoints (the module performs the OAuth HTTP calls directly).
