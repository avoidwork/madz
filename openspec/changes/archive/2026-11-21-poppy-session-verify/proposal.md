# Proposal

## Why

Poppy is bidirectional: madz can act as a personal agent (issues #2002-#2005) or as a company. To act as a company, madz must verify the incoming `Poppy-Session` header before relying on session claims, verify delegations and signatures, and enforce access token binding. This is the counterpart to issue #2004 (session signing) and completes the company-side verification path.

## What Changes

- Add a `poppy` verification module at `src/tools/poppy/verify.js` that verifies incoming Poppy-Session JWTs, delegations, and access tokens on company-side endpoints.
- Fetch the client metadata from `iss` (without following redirects) and the public keys from `jwks_uri`.
- Verify the session JWT's delegation and signature: check the delegation's `typ`, `iss`, `exp` (at most 24h after `iat`), and verify the session JWT with the delegated key in `cnf.jwk`.
- Check `typ: poppy-session+jwt`, `aud` equals the company identifier, `htm`/`htu` match the request, and `iat` is within an acceptance window.
- Check `ath` matches the access token when present, and that the token was issued to the same `client_id` as `iss`.
- Look up the session by `client_id`, `sid`, and user ID; start a new signed-out session for unknown combinations.
- Return `invalid_session` (400) or `session_ended` (400) on failure.
- Wire the verify module into the `poppy` tool's ACTIONS registry in `src/tools/poppy/index.js` as a new `verify` action.
- Add unit tests under `tests/unit/tools/poppy/verify.test.js` and an integration test under `tests/integration/tools/poppy/verify.test.js`.

## Capabilities

### New Capabilities
- `poppy-session-verify`: verify incoming Poppy-Session JWTs, delegations, and access tokens on company-side endpoints so madz can act as a company that accepts personal agents.

### Modified Capabilities
<!-- No existing spec-level behavior changes. -->

## Impact

- `src/tools/poppy/verify.js` — new verification module (metadata/JWKS fetch, delegation and signature verification, claim validation, `ath` binding, session lookup, error mapping).
- `src/tools/poppy/index.js` — wire the `verify` action into ACTIONS and the schema.
- `tests/unit/tools/poppy/verify.test.js` — unit tests.
- `tests/integration/tools/poppy/verify.test.js` — integration test.

## Non-goals

- No HTTP transport layer for the agent side — this is company-side verification only.
- No OAuth flows beyond access token binding checks.
- No changes to other tools.
