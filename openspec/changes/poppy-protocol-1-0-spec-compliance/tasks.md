# Tasks

## 1. Delegation & session signing (session.js)

- [ ] 1.1 Remove `.setSubject(userId)` and `.setAudience(audience)` from `issueDelegation` so the delegation payload carries only `iss`, `cnf.jwk`, `iat`, `exp`, `jti`; verify the delegation unit test asserts the payload has no `sub`/`aud`
- [ ] 1.2 Update `DelegationInputSchema` to drop `userId`/`audience`; verify the delegation input test passes without those fields
- [ ] 1.3 Fix the returned `kid` in `issueDelegation` to name the signing key from `jwks_uri`; verify the delegation test asserts the correct `kid`
- [ ] 1.4 Remove the non-existent `POPPY_EXTENSIONS = "session"` and emit the `Poppy-Extensions` header per RFC 9651; verify the session header test passes

## 2. Session verification (verify.js)

- [ ] 2.1 Remove the stray `}` in the JSDoc at verify.js:40; verify lint passes
- [ ] 2.2 Verify the session `kid` against the delegated key thumbprint in `verifySessionJwt`; verify the session verify test covers a `kid` mismatch
- [ ] 2.3 Enforce `ath` absence when no access token is present in `validateAccessToken`; verify the access token test covers `ath` presence without a token
- [ ] 2.4 Check the `Poppy-Version` header in `execute`; verify the verify test covers an unsupported version returning `version_unsupported`

## 3. Conversation (conversation.js)

- [ ] 3.1 Replace `MessageSchema` with the spec `author:{type}` + `text`/`data`/`context`/`extensions` shape; verify the conversation message test uses the new shape
- [ ] 3.2 Correct `CONVERSATION_ERROR_STATUS` to 409/409/410/409; verify the conversation error test asserts the correct status codes
- [ ] 3.3 Move `requestId` into the POST body and include the first message in `startConversation`; verify the start conversation test asserts the request id in the body
- [ ] 3.4 Validate the response shape in `readEvents`/`streamEvents` (conversation_id, events, cursor, has_more, working, handoff, responder, closed); verify the read events test covers the response shape

## 4. Tasks schema (tasks.js)

- [ ] 4.1 Fix `VALID_SKILL_TYPES` to `skill-md`/`archive`; verify the tasks test accepts those types and rejects others
- [ ] 4.2 Correct `ExcludedTaskSchema` to `task` (required) + `alternative` object; verify the excluded task test covers the new shape
- [ ] 4.3 Change `skill_index` to the spec `{ "$schema", "skills": [...] }` shape; verify the tasks response test validates the new shape
- [ ] 4.4 Fix `fetchSkill` digest to SHA-256 of raw bytes prefixed `sha256:`; verify the skill digest test asserts the `sha256:` prefix
- [ ] 4.5 Cap `task` at 200 chars; verify the feedback test covers a task over 200 chars

## 5. OAuth & device sign-in (oauth.js, api.js, identity.js)

- [ ] 5.1 Add client assertions to `requestDeviceCode` and `pollDeviceToken`; verify the device sign-in test asserts the client assertion is present
- [ ] 5.2 Add a client assertion and `token_type_hint=refresh_token` default to `revokeToken`; verify the revocation test asserts both
- [ ] 5.3 Make the Direct Sign-In `iss` check mandatory; verify the oauth test covers a missing `iss`
- [ ] 5.4 Require `prompt=consent` unless same-device; verify the oauth test covers the same-device case
- [ ] 5.5 Fetch protected-resource metadata from the domain host; verify the metadata test asserts the domain host
- [ ] 5.6 Add the verification-URI host check in `deviceSignIn`; verify the device sign-in test covers a host mismatch
- [ ] 5.7 Replace `client_credentials` with a `private_key_jwt` client assertion in `callMcp`; verify the MCP token test asserts the assertion
- [ ] 5.8 Validate `client_id == fetch URL` in identity.js; verify the identity test covers a mismatch

## 6. Discovery (discovery.js)

- [ ] 6.1 Treat unknown `scope_hints.changes` values as `irreversible`; verify the discovery test covers an unknown value
- [ ] 6.2 Fix `selectVersion` to accept newer minor versions from 1.0; verify the discovery test covers a 1.1 document for a 1.0 agent
- [ ] 6.3 Add the issuer/protected-resource cross-check; verify the discovery test covers the cross-check
- [ ] 6.4 Validate `supported_versions` URLs and fetch the selected version's document; verify the discovery test covers URL validation
- [ ] 6.5 Resolve DNS in `isPrivateAddress`; verify the discovery test covers a DNS-resolved private address
- [ ] 6.6 Enforce `web.disabled`/`auth.disabled` cross-field constraints; verify the discovery test covers both constraints

## 7. Extensions header (extensions.js)

- [ ] 7.1 Change `buildExtensionsHeader` to emit RFC 9651 List of Strings with a `v` parameter; verify the extensions test asserts the `v` parameter format

## 8. Blind signing (security.js)

- [ ] 8.1 Implement RSA blind signatures per RFC 9474 yielding PS384 in `blindSign`; verify the blind signing test asserts PS384

## 9. Verification

- [ ] 9.1 Run `npm run test` and verify all tests pass
- [ ] 9.2 Run `npm run lint` and verify lint passes
- [ ] 9.3 Run `npm run coverage` and verify coverage is maintained

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
