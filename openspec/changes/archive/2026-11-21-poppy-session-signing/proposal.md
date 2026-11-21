# Proposal

## Why

Poppy sessions tie a user's activity at one company through one personal agent across APIs, conversations, and web browsing. The agent sends a `Poppy-Session` header (a JWT signed with a delegated key) on every request. This is the core identity-and-continuity layer that all channels depend on, building on the already-merged Poppy discovery (#2002) and agent identity (#2003) features.

## What Changes

- Add a `poppy` session module at `src/tools/poppy/session.js` that generates a Session JWT per request with `typ: poppy-session+jwt`, `alg: ES256`, and claims `iss` (client_id), `aud` (company identifier), `sid` (random, unguessable session ID), `sub` (user ID), optional `agent_id`, `htm`/`htu` (method and URL), `iat`, `jti`, and `ath` (SHA-256 hash of access token when present).
- Sign the Session JWT with a delegated key, carrying the delegation in the `poppy_dlg` protected header.
- Issue delegations: a short-lived JWT (`typ: poppy-delegation+jwt`) signed by a key in `jwks_uri`, naming the delegated key in `cnf.jwk`, with `exp` at most 24 hours after `iat`.
- Use each delegated key for one user ID only (key-to-user isolation).
- Produce the `Poppy-Version` and `Poppy-Extensions` headers alongside the session header.
- Wire the session module into the `poppy` tool's ACTIONS registry in `src/tools/poppy/index.js` as a new `session` action.
- Add unit tests under `tests/unit/tools/poppy/session.test.js` and an integration test under `tests/integration/tools/poppy/session.test.js`.

## Capabilities

### New Capabilities
- `poppy-session-signing`: generate and sign Poppy-Session JWTs with delegated keys, issue delegations, and emit the associated Poppy headers.

### Modified Capabilities
<!-- No existing spec-level behavior changes. -->

## Impact

- `src/tools/poppy/session.js` — new session module (session JWT generation, delegation issuance, key isolation, headers).
- `src/tools/poppy/index.js` — wire the `session` action into ACTIONS and the schema.
- `tests/unit/tools/poppy/session.test.js` — unit tests.
- `tests/integration/tools/poppy/session.test.js` — integration test.

## Non-goals

- No HTTP transport layer — the module produces the signed JWT and associated headers.
- No OAuth flows beyond session/delegation signing.
- No changes to other tools.
