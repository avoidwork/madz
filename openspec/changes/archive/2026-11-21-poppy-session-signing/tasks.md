# Tasks

## 1. Session module

- [x] 1.1 Create `src/tools/poppy/session.js` with a Zod schema for session signing input and verify unit tests cover valid and missing-field cases
- [x] 1.2 Implement Session JWT generation with `typ: poppy-session+jwt`, `alg: ES256`, and claims `iss`, `aud`, `sid`, `sub`, optional `agent_id`, `htm`/`htu`, `iat`, `jti`, and `ath` (SHA-256 of access token when present), and verify unit tests cover the claims, `sid`/`jti` uniqueness, and `ath` computation
- [x] 1.3 Implement signing with a delegated key carrying the delegation in the `poppy_dlg` protected header, and verify unit tests cover the `poppy_dlg` header and signature verification
- [x] 1.4 Implement delegation issuance (`typ: poppy-delegation+jwt`) signed by a key in `jwks_uri`, naming the delegated key in `cnf.jwk`, with `exp` at most 24 hours after `iat`, and verify unit tests cover the delegation claims and `exp` limit
- [x] 1.5 Implement per-user delegated key isolation (each key for one user ID only) and verify unit tests cover the bound-user success and cross-user rejection cases
- [x] 1.6 Implement emission of `Poppy-Version` and `Poppy-Extensions` headers alongside the session header, and verify unit tests cover the header values

## 2. Tool wiring

- [x] 2.1 Wire the session module into `src/tools/poppy/index.js` as a `session` action in the ACTIONS registry, update the `poppySchema` action enum and `superRefine`, and update the tool description, and verify the poppy tool still exports correctly

## 3. Tests

- [x] 3.1 Create `tests/unit/tools/poppy/session.test.js` covering session JWT claims, delegation issuance, `ath` computation, per-user key isolation, `exp` limits, and edge cases (missing claims, expired delegation, wrong `aud`, `htm`/`htu` mismatch, access token without `ath`), and verify `npm run test` passes
- [x] 3.2 Create `tests/integration/tools/poppy/session.test.js` signing a session JWT and verifying it against a mock verifier, and verify `npm run test` passes

## 4. Verify

- [x] 4.1 Run `npm run test`
- [x] 4.2 Run `npm run lint`
- [x] 4.3 Run `npm run coverage`

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
