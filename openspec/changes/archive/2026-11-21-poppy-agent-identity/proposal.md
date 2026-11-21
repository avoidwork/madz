# Proposal

## Why

Poppy requires a personal agent's `client_id` to be an HTTPS URL returning its client metadata document (CIMD). Companies fetch it to learn who the agent is, to obtain the keys it signs client assertions and delegations with, and to determine where Direct Sign-In may return the user. This is the identity foundation that all OAuth flows and session signing depend on, building on the already-merged Poppy discovery feature (issue #2002).

## What Changes

- Add a `poppy` identity module at `src/tools/poppy/identity.js` that serves a client metadata document at the configured `client_id` URL, with `client_id` equal to the URL it was fetched from.
- Expose `client_name`, `logo_uri`, `jwks_uri`, `redirect_uris`, and `token_endpoint_auth_method` in the CIMD.
- Generate and manage the agent's JWK key set at `jwks_uri` (public keys only), on the same domain as `client_id`.
- Manage `redirect_uris` (HTTPS URLs on the same domain as `client_id`, or loopback redirect URIs per RFC 8252 §7.3).
- Configure `token_endpoint_auth_method` as `private_key_jwt`.
- Sign client assertions (RFC 7523) with a key from `jwks_uri`, with `aud` set to the company's issuer, `iat`, unique `jti`, and `exp` at most 5 minutes after `iat`.
- Support ES256 and PS384 signing.
- Add `jose` (v5.x+) as a dependency.
- Add unit tests under `tests/unit/tools/poppy/identity.test.js` and an integration test under `tests/integration/tools/poppy/identity.test.js`.

## Capabilities

### New Capabilities
- `poppy-agent-identity`: publish and manage the agent's Poppy client metadata document (CIMD) and signing key set, including client assertion signing.

### Modified Capabilities
<!-- No existing spec-level behavior changes. -->

## Impact

- `src/tools/poppy/identity.js` — new identity module (CIMD, JWKS, client assertions).
- `src/tools/poppy/index.js` — wire identity into the poppy tool module if appropriate.
- `package.json` — add `jose` dependency.
- `tests/unit/tools/poppy/identity.test.js` — unit tests.
- `tests/integration/tools/poppy/identity.test.js` — integration test.

## Non-goals

- No OAuth/session/API layers beyond identity (later steps in the series).
- No third-party identity service — local key management (local-first).
- No changes to other tools.
