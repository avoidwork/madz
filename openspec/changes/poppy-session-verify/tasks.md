# Tasks

## 1. Verification module

- [ ] 1.1 Create `src/tools/poppy/verify.js` with a Zod schema for verification input and verify unit tests cover valid and missing-field cases
- [ ] 1.2 Implement fetching the client metadata from `iss` (without following redirects) and the public keys from `jwks_uri`, and verify unit tests cover metadata/JWKS fetch and failure cases
- [ ] 1.3 Implement delegation and signature verification (delegation `typ`, `iss`, `exp` at most 24h after `iat`; session JWT verified with the delegated key in `cnf.jwk`), and verify unit tests cover missing delegation, expired delegation, and signature mismatch
- [ ] 1.4 Implement session JWT claim validation (`typ: poppy-session+jwt`, `aud` equals company identifier, `htm`/`htu` match request, `iat` within acceptance window), and verify unit tests cover wrong `aud`, `htm`/`htu` mismatch, and stale `iat`
- [ ] 1.5 Implement access token binding validation (`ath` matches token when present; token issued to same `client_id` as `iss`), and verify unit tests cover `ath` mismatch and client_id mismatch
- [ ] 1.6 Implement session lookup by `client_id`, `sid`, and user ID, starting a new signed-out session for unknown combinations, and verify unit tests cover known-session and unknown-combination cases
- [ ] 1.7 Implement `invalid_session` (400) and `session_ended` (400) error mapping, and verify unit tests cover the error codes and statuses

## 2. Tool wiring

- [ ] 2.1 Wire the verify module into `src/tools/poppy/index.js` as a `verify` action in the ACTIONS registry, update the `poppySchema` action enum and `superRefine`, and update the tool description, and verify the poppy tool still exports correctly

## 3. Tests

- [ ] 3.1 Create `tests/unit/tools/poppy/verify.test.js` covering delegation chain, signature, claims, `ath`, `htm`/`htu`, session lookup, and edge cases (missing delegation, expired delegation, wrong `aud`, `htm`/`htu` mismatch, replayed `jti`, unknown session), and verify `npm run test` passes
- [ ] 3.2 Create `tests/integration/tools/poppy/verify.test.js` verifying a signed session JWT against a mock company endpoint, and verify `npm run test` passes

## 4. Verify

- [ ] 4.1 Run `npm run test`
- [ ] 4.2 Run `npm run lint`
- [ ] 4.3 Run `npm run coverage`

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
