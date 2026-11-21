# Tasks

## 1. Dependency setup

- [x] 1.1 Add `jose` (v5.x+) to `package.json` dependencies and verify `npm install` succeeds

## 2. Identity module

- [x] 2.1 Create `src/tools/poppy/identity.js` with a Zod schema for the client metadata document (CIMD) and verify unit tests cover valid and missing-field cases
- [x] 2.2 Implement CIMD generation that sets `client_id` equal to the configured `client_id` URL and exposes `client_name`, `logo_uri`, `jwks_uri`, `redirect_uris`, and `token_endpoint_auth_method` (`private_key_jwt`), and verify unit tests cover the document shape and `client_id` equality
- [x] 2.3 Implement JWK key set generation (ES256 and PS384) publishing public keys only at `jwks_uri` on the same domain as `client_id`, and verify unit tests cover public-only keys and domain match
- [x] 2.4 Implement `redirect_uris` validation (HTTPS on-domain, or loopback per RFC 8252 §7.3) and verify unit tests cover on-domain, loopback, off-domain, and non-HTTPS cases
- [x] 2.5 Implement RFC 7523 client assertion signing with `aud` (company issuer), `iat`, unique `jti`, `exp` at most 5 minutes after `iat`, supporting ES256 and PS384, and verify unit tests cover claims, exp window, jti uniqueness, and unsupported-algorithm rejection

## 3. Tool wiring

- [x] 3.1 Wire the identity module into `src/tools/poppy/index.js` if appropriate and verify the poppy tool still exports correctly

## 4. Tests

- [x] 4.1 Create `tests/unit/tools/poppy/identity.test.js` covering CIMD shape, `client_id` equality, key generation, redirect validation, and client assertion claims/signing, and verify `npm run test` passes
- [x] 4.2 Create `tests/integration/tools/poppy/identity.test.js` serving the metadata document and verifying it is fetchable and valid, and verify `npm run test` passes

## 5. Verify

- [x] 5.1 Run `npm run test`
- [x] 5.2 Run `npm run lint`
- [x] 5.3 Run `npm run coverage`

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
