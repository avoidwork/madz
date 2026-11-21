# Design

## Context

See proposal.md - Why. madz needs a `poppy` session module that generates and signs Poppy-Session JWTs with delegated keys, issues delegations, and emits the associated Poppy headers. This builds on the already-merged `src/tools/poppy/discovery.js`, `src/tools/poppy/identity.js`, and `src/tools/poppy/index.js` (issues #2002, #2003). The project uses Zod for validation, pino for structured logging, and `node --test` for tests. `jose` v6.2.18 is already a dependency.

## Goals / Non-Goals

**Goals:**
- Add `src/tools/poppy/session.js` that generates a Session JWT per request with the required claims and headers.
- Sign the Session JWT with a delegated key, carrying the delegation in the `poppy_dlg` header.
- Issue delegations (`typ: poppy-delegation+jwt`) signed by a key in `jwks_uri`, naming the delegated key in `cnf.jwk`, with `exp` at most 24 hours after `iat`.
- Enforce per-user delegated key isolation.
- Emit `Poppy-Version` and `Poppy-Extensions` headers alongside the session header.
- Wire the session module into the `poppy` tool's ACTIONS registry as a `session` action.
- Add unit and integration tests.

**Non-Goals:**
- No HTTP transport layer — the module produces the signed JWT and associated headers.
- No OAuth flows beyond session/delegation signing.
- No changes to other tools.

## Decisions

### Decision 1: Use `jose` for JWT signing and JWK thumbprints
`jose` (v6.2.18) provides `SignJWT`, `exportJWK`, `calculateJwkThumbprint`, and `importJWK`. It handles JWS serialization and algorithm negotiation cleanly and is the project's stated dependency in the issue. **Alternative considered:** `node:crypto` directly — rejected because `jose` handles JWK/JWS serialization and thumbprints cleanly.

### Decision 2: Split session logic into `session.js`, registration in `index.js`
Mirror the discovery/identity pattern: `src/tools/poppy/session.js` holds the session and delegation logic (unit-testable without a LangChain tool), while `src/tools/poppy/index.js` wires it into the `poppy` tool module. **Alternative considered:** single file — rejected to keep session logic isolated and testable.

### Decision 3: Delegated keys persisted server-side, never exposed to model
Delegated keys are generated and persisted server-side (via `options.keyDir`), loaded for signing, and never returned to the model context. Only public JWK material and signed JWTs are returned. **Alternative considered:** passing keys through model context — rejected as a credential-storage risk (OWASP).

### Decision 4: Zod schema for session and delegation input validation
Session signing input and delegation issuance input are validated against Zod schemas per project convention. Required fields are enforced; optional fields (`agent_id`, `ath`) are omitted when absent.

### Decision 5: Enforce per-user delegated key isolation
Each delegated key is bound to a single user ID. A registry maps delegated key → user ID, and signing for a different user with the same key is rejected. **Alternative considered:** allowing key reuse — rejected as a cross-user credential reuse risk.

### Decision 6: `ath` computed as SHA-256 of the access token
When an access token is present, `ath` is the SHA-256 hash of the access token. When absent, `ath` is omitted. **Alternative considered:** always including `ath` — rejected because the protocol only requires it when an access token is present.

## Risks / Trade-offs

- **[Delegated key leakage]** Delegated key material could be exposed → Mitigation: keys persisted server-side, only public JWK material and signed JWTs returned, never log key material.
- **[Key isolation breach]** A delegated key reused across users → Mitigation: per-user key registry enforces one-user-per-key.
- **[Coverage]** New code needs test coverage → Mitigation: unit tests for session claims, delegation issuance, `ath` computation, per-user isolation, `exp` limits; integration test verifying a signed session JWT against a mock verifier.
- **[jose dependency]** Already a dependency → Mitigation: pinned to v6.2.18.

## Migration Plan

No migration needed — this is a new module. Rollback is removing the session module and its registration.

## Open Questions

None.
