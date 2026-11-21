# Design

## Context

See proposal.md - Why. madz needs a `poppy` verification module that verifies incoming Poppy-Session JWTs, delegations, and access tokens on company-side endpoints. This builds on the already-merged `src/tools/poppy/discovery.js`, `src/tools/poppy/identity.js`, `src/tools/poppy/session.js`, `src/tools/poppy/oauth.js`, and `src/tools/poppy/index.js` (issues #2002-#2005). The project uses Zod for validation, pino for structured logging, and `node --test` for tests. `jose` v6.2.18 is already a dependency.

## Goals / Non-Goals

**Goals:**
- Add `src/tools/poppy/verify.js` that verifies incoming Poppy-Session JWTs, delegations, and access tokens.
- Fetch client metadata from `iss` (without following redirects) and public keys from `jwks_uri`.
- Verify the session JWT's delegation and signature (delegation `typ`, `iss`, `exp` at most 24h after `iat`; session JWT verified with the delegated key in `cnf.jwk`).
- Validate session JWT claims (`typ: poppy-session+jwt`, `aud` equals company identifier, `htm`/`htu` match request, `iat` within acceptance window).
- Validate access token binding (`ath` matches token when present; token issued to same `client_id` as `iss`).
- Look up the session by `client_id`, `sid`, and user ID; start a new signed-out session for unknown combinations.
- Return `invalid_session` (400) or `session_ended` (400) on failure.
- Wire the verify module into the `poppy` tool's ACTIONS registry as a `verify` action.
- Add unit and integration tests.

**Non-Goals:**
- No agent-side session signing (already in #2004).
- No OAuth flows beyond access token binding checks.
- No changes to other tools.

## Decisions

### Decision 1: Use `jose` for JWT verification and JWK thumbprints
`jose` (v6.2.18) provides `jwtVerify`, `importJWK`, `createLocalJWKSet`, and `calculateJwkThumbprint`. It handles JWS verification and JWK handling cleanly and is the project's stated dependency. **Alternative considered:** `node:crypto` directly — rejected because `jose` handles JWK/JWS verification and thumbprints cleanly.

### Decision 2: Split verification logic into `verify.js`, registration in `index.js`
Mirror the discovery/identity/session/oauth pattern: `src/tools/poppy/verify.js` holds the verification logic (unit-testable without a LangChain tool), while `src/tools/poppy/index.js` wires it into the `poppy` tool module. **Alternative considered:** single file — rejected to keep verification logic isolated and testable.

### Decision 3: Fetch client metadata without following redirects
The client metadata document is fetched from `iss` with `redirect: "manual"` to prevent redirect-based confusion (SSRF/issuer confusion). The `jwks_uri` is then fetched from the validated metadata. **Alternative considered:** following redirects — rejected as a security risk.

### Decision 4: Session store injected via options
The session store is accessed via an injected interface (`options.sessionStore`) rather than a concrete DB, keeping the module focused on verification logic and testable. **Alternative considered:** hard-coded DB dependency — rejected to keep the module decoupled.

### Decision 5: Zod schema for verification input validation
Verification input is validated against a Zod schema per project convention. Required fields are enforced; optional fields are omitted when absent.

### Decision 6: Reuse `computeAth` from `session.js`
The `ath` check reuses the `computeAth` helper from `src/tools/poppy/session.js` to ensure the hash matches what the agent-side signing produces. **Alternative considered:** duplicating the hash — rejected as a DRY violation.

## Risks / Trade-offs

- **[Metadata fetch failure]** Client metadata or JWKS may be unreachable → Mitigation: timeouts via `AbortController`; errors returned as `{ ok: false, error }`.
- **[Redirect-based issuer confusion]** Following redirects could confuse the issuer → Mitigation: fetch with `redirect: "manual"`.
- **[Coverage]** New code needs test coverage → Mitigation: unit tests for delegation chain, signature, claims, `ath`, `htm`/`htu`, session lookup; integration test verifying a signed session JWT against a mock company endpoint.
- **[jose dependency]** Already a dependency → Mitigation: pinned to v6.2.18.

## Migration Plan

No migration needed — this is a new module. Rollback is removing the verify module and its registration.

## Open Questions

None.
