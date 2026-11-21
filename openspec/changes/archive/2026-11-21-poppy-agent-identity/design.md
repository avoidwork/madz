# Design

## Context

See proposal.md - Why. madz needs a `poppy` identity module that publishes a client metadata document (CIMD) at the agent's `client_id` URL, manages its JWK key set, and signs RFC 7523 client assertions. This builds on the already-merged `src/tools/poppy/discovery.js` and `src/tools/poppy/index.js` (issue #2002). The project uses Zod for validation, pino for structured logging, and `node --test` for tests.

## Goals / Non-Goals

**Goals:**
- Add `src/tools/poppy/identity.js` that produces a CIMD at the configured `client_id` URL.
- Generate and manage the agent's JWK key set (public keys only) at `jwks_uri` on the client_id domain.
- Validate and manage `redirect_uris` (HTTPS on-domain, or loopback per RFC 8252 §7.3).
- Sign RFC 7523 client assertions with ES256 and PS384.
- Add `jose` dependency and unit + integration tests.

**Non-Goals:**
- No OAuth/session/API layers beyond identity (later steps).
- No third-party identity service — local key management (local-first).
- No changes to other tools.

## Decisions

### Decision 1: Use `jose` for key generation and signing
`jose` (v5.x+) is the actively maintained JWT/JWK library. It provides `generateKeyPair`, `exportJWK`, `exportJWK`, `SignJWT`, and `importJWK` for ES256 and PS384. **Alternative considered:** `node:crypto` directly — rejected because `jose` handles JWK/JWS serialization and algorithm negotiation cleanly and is the project's stated dependency in the issue.

### Decision 2: Split identity logic into `identity.js`, registration in `index.js`
Mirror the discovery pattern: `src/tools/poppy/identity.js` holds the CIMD, JWKS, and client-assertion logic (unit-testable without a LangChain tool), while `src/tools/poppy/index.js` wires it into the `poppy` tool module. **Alternative considered:** single file — rejected to keep identity logic isolated and testable.

### Decision 3: Private keys from env/settings, never config files
Private key material is loaded from `process.env` or a settings module, never stored in `config.yaml` or model context. The JWKS publishes public keys only. **Alternative considered:** persisting keys in config — rejected as a credential-storage risk (OWASP).

### Decision 4: Zod schema for metadata validation
The CIMD is validated against a Zod schema per project convention. Required fields: `client_id`, `client_name`, `jwks_uri`, `redirect_uris`, `token_endpoint_auth_method`. `logo_uri` optional.

### Decision 5: Strict redirect_uri validation
`redirect_uris` must be HTTPS on the same domain as `client_id`, or loopback URIs per RFC 8252 §7.3. Off-domain and non-HTTPS URIs are rejected. **Alternative considered:** accepting any URI — rejected as an OWASP open-redirect risk.

### Decision 6: Client assertion claims
Assertions include `aud` (company issuer), `iat`, unique `jti`, and `exp` at most 5 minutes after `iat`. `jti` uniqueness is enforced via a monotonic counter or random UUID. **Alternative considered:** fixed jti — rejected because replay protection requires uniqueness.

## Risks / Trade-offs

- **[Private key leakage]** Private key material could be exposed → Mitigation: keys from env/settings, JWKS publishes public keys only, never log key material.
- **[Key rotation]** Long-lived keys may need rotation → Mitigation: key generation is idempotent and re-runnable; JWKS reflects current keys.
- **[Coverage]** New code needs test coverage → Mitigation: unit tests for CIMD shape, JWKS, redirect validation, assertion claims/signing; integration test serving the CIMD.
- **[jose dependency]** New runtime dependency → Mitigation: pinned to v5.x+, actively maintained.

## Migration Plan

No migration needed — this is a new module. Rollback is removing the identity module and its registration.

## Open Questions

None.
