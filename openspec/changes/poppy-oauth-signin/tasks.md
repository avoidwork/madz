# Tasks

## 1. OAuth module

- [ ] 1.1 Create `src/tools/poppy/oauth.js` with Zod schemas for OAuth metadata, token, and device code responses, and verify unit tests cover valid and malformed response cases
- [ ] 1.2 Implement OAuth metadata discovery (RFC 8414 authorization server metadata and RFC 9728 protected resource metadata) with issuer validation, and verify unit tests cover endpoint extraction and issuer mismatch
- [ ] 1.3 Implement Direct Sign-In: build the authorization URL with `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge`, `code_challenge_method=S256`, generate the PKCE verifier and S256 challenge, and verify unit tests cover URL construction and PKCE derivation
- [ ] 1.4 Implement Direct Sign-In `iss` validation on the redirect and code exchange at the token endpoint with a client assertion, and verify unit tests cover `iss` mismatch, `invalid_grant`, and `invalid_scope`
- [ ] 1.5 Implement `prompt=consent` enforcement for cross-device Direct Sign-In, and verify unit tests cover the consent parameter
- [ ] 1.6 Implement Device Sign-In: request a device code, surface the verification URI and user code, and poll the token endpoint until approved, denied, or expired, and verify unit tests cover polling, `access_denied`, and expiration
- [ ] 1.7 Implement refresh token rotation (RFC 6749 §6) and revocation (RFC 7009), and verify unit tests cover rotation and revocation
- [ ] 1.8 Implement DPoP (RFC 9449) proof generation when the issuer metadata lists `dpop_signing_alg_values_supported`, and verify unit tests cover proof generation, conditional generation, and refresh token binding
- [ ] 1.9 Implement the `execute` dispatcher with handlers named without an `Action` suffix (`directSignIn`, `deviceSignIn`, `refreshToken`, `revokeToken`), and verify unit tests cover dispatch

## 2. Tool wiring

- [ ] 2.1 Wire the oauth module into `src/tools/poppy/index.js` as an `oauth` action in the ACTIONS registry, update the `poppySchema` action enum and `superRefine`, and update the tool description, and verify the poppy tool still exports correctly

## 3. Tests

- [ ] 3.1 Create `tests/unit/tools/poppy/oauth.test.js` covering authorization URL construction, PKCE, token exchange, device flow polling, refresh rotation, revocation, DPoP, `iss` mismatch, `invalid_grant`, `invalid_scope`, expired device code, DPoP key binding, and `prompt=consent` enforcement, and verify `npm run test` passes
- [ ] 3.2 Create `tests/integration/tools/poppy/oauth.test.js` running Direct Sign-In and Device Sign-In against a mock OAuth server, and verify `npm run test` passes

## 4. Verify

- [ ] 4.1 Run `npm run test`
- [ ] 4.2 Run `npm run lint`
- [ ] 4.3 Run `npm run coverage`

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
