# Design

## Context

See proposal.md - Why. madz needs a `poppy` OAuth module that implements Direct Sign-In (authorization code + PKCE) and Device Sign-In (device authorization grant), building on the already-merged `src/tools/poppy/discovery.js`, `src/tools/poppy/identity.js`, `src/tools/poppy/session.js`, and `src/tools/poppy/index.js` (issues #2002, #2003, #2004). The project uses Zod for validation, pino for structured logging, and `node --test` for tests. `jose` v6.2.18 is already a dependency and provides `SignJWT`, `generateKeyPair`, `exportJWK`, and `importJWK`.

## Goals / Non-Goals

**Goals:**
- Add `src/tools/poppy/oauth.js` that discovers OAuth metadata (RFC 8414 / RFC 9728) and implements Direct Sign-In, Device Sign-In, refresh rotation, revocation, and DPoP.
- Wire the oauth module into the `poppy` tool's ACTIONS registry as an `oauth` action.
- Reuse the identity module's `signClientAssertion` for client assertions.
- Keep secrets (tokens, codes, PKCE verifiers) out of model context.
- Add unit and integration tests.

**Non-Goals:**
- No persistence of tokens beyond what the module returns (token storage is out of scope).
- No changes to other tools or the existing discovery/identity/session modules beyond wiring the new action.
- No HTTP transport layer beyond the OAuth endpoints.

## Decisions

### Decision 1: Use `jose` for client assertion and DPoP signing
`jose` (v6.2.18) provides `SignJWT`, `generateKeyPair`, `exportJWK`, and `importJWK`. It handles JWS serialization and algorithm negotiation cleanly and is the project's stated dependency. **Alternative considered:** `node:crypto` directly — rejected because `jose` handles JWK/JWS serialization and DPoP proof construction cleanly.

### Decision 2: Split OAuth logic into `oauth.js`, registration in `index.js`
Mirror the discovery/identity/session pattern: `src/tools/poppy/oauth.js` holds the OAuth logic (unit-testable without a LangChain tool), while `src/tools/poppy/index.js` wires it into the `poppy` tool module. **Alternative considered:** single file — rejected to keep OAuth logic isolated and testable.

### Decision 3: Action-module convention with handlers named without an `Action` suffix
`oauth.js` exports an `execute` function dispatching on an `op` field to internal handlers named without an `Action` suffix (e.g., `directSignIn`, `deviceSignIn`, `refreshToken`, `revokeToken`), matching the sql/nosql driver/engine pattern. **Alternative considered:** `Action`-suffixed handlers — rejected to match the established convention.

### Decision 4: Reuse the identity module's `signClientAssertion`
Client assertions for token exchanges reuse the identity module's `signClientAssertion`, which sets `aud` to the company's issuer, `iat`, a unique `jti`, and `exp` at most 5 minutes after `iat`. **Alternative considered:** reimplementing assertion signing — rejected as duplication (DRY).

### Decision 5: Zod schemas for all OAuth responses
Metadata, token, and device code responses are validated against Zod schemas per project convention. Required fields are enforced; malformed responses are rejected. **Alternative considered:** ad-hoc validation — rejected as inconsistent with the project's Zod convention.

### Decision 6: DPoP conditional on issuer metadata
DPoP proofs are generated only when the issuer metadata lists `dpop_signing_alg_values_supported`. **Alternative considered:** always generating DPoP proofs — rejected as unnecessary complexity for issuers that don't support it.

### Decision 7: Secrets kept out of model context
Access tokens, refresh tokens, authorization codes, and PKCE verifiers are kept server-side and never returned to the model context. Only non-secret results (e.g., success indicators, verification URIs) are returned. **Alternative considered:** returning tokens to the model — rejected as a credential-storage risk (OWASP).

## Risks / Trade-offs

- **[Secret leakage]** Tokens/codes/PKCE verifiers could be exposed → Mitigation: kept server-side, never returned to model context, never logged.
- **[Issuer mismatch]** A redirect or metadata `iss` mismatch could enable token injection → Mitigation: validate `iss` on redirects and metadata against the expected issuer.
- **[Coverage]** New code needs test coverage → Mitigation: unit tests for authorization URL construction, PKCE, token exchange, device flow polling, refresh rotation, revocation, DPoP, and edge cases; integration test against a mock OAuth server.
- **[jose dependency]** Already a dependency → Mitigation: pinned to v6.2.18.
- **[DPoP complexity]** DPoP adds proof-generation complexity → Mitigation: only generated when the issuer advertises support.

## Migration Plan

No migration needed — this is a new module. Rollback is removing the oauth module and its registration.

## Open Questions

None.
