# Proposal

## Why

The Poppy tool in `src/tools/poppy/` has multiple compliance violations against the Personal Agent Protocol 1.0 spec. The implementation drifted from the spec across delegation, conversation, tasks, OAuth/device sign-in, discovery, extensions, verification, and security modules, producing non-compliant payload shapes, status codes, header formats, and missing client-assertion/issuer checks. This change brings the tool into full spec compliance.

## What Changes

- **Delegation payload (session.js):** Remove `sub`/`aud` from delegation JWTs so the payload carries only `iss`, `cnf.jwk`, `iat`, `exp`, `jti`. Drop `userId`/`audience` from `DelegationInputSchema`, fix the returned `kid` to name the signing key from `jwks_uri`, and remove the non-existent `POPPY_EXTENSIONS = "session"`.
- **Session verification (verify.js):** Remove the stray `}` in the JSDoc, verify the session `kid` against the delegated key thumbprint, enforce `ath` absence when no access token is present, and check the `Poppy-Version` header.
- **Conversation (conversation.js):** Replace `MessageSchema` with the spec `author:{type}` + `text`/`data`/`context`/`extensions` shape. Correct `CONVERSATION_ERROR_STATUS` to 409/409/410/409. Move `requestId` into the POST body and include the first message in `startConversation`. Validate the response shape in `readEvents`/`streamEvents`.
- **Tasks (tasks.js):** Fix `VALID_SKILL_TYPES` to `skill-md`/`archive`, correct `ExcludedTaskSchema` to `task` + `alternative` object, change `skill_index` to the spec `{ "$schema", "skills": [...] }` shape, fix `fetchSkill` digest to SHA-256 of raw bytes prefixed `sha256:`, and cap `task` at 200 chars.
- **OAuth & device sign-in (oauth.js, api.js, identity.js):** Add client assertions to `requestDeviceCode`, `pollDeviceToken`, and `revokeToken` (with `token_type_hint=refresh_token`). Make the Direct Sign-In `iss` check mandatory, require `prompt=consent` unless same-device, fetch protected-resource metadata from the domain host, and add the verification-URI host check. Replace `client_credentials` with a `private_key_jwt` assertion in `callMcp`. Validate `client_id == fetch URL`.
- **Discovery (discovery.js):** Treat unknown `scope_hints.changes` values as `irreversible`, fix `selectVersion` to accept newer minor versions from 1.0, add the issuer/protected-resource cross-check, validate `supported_versions` URLs, resolve DNS in `isPrivateAddress`, and enforce `web.disabled`/`auth.disabled` cross-field constraints.
- **Extensions (extensions.js):** Emit the `Poppy-Extensions` header as an RFC 9651 List of Strings with a `v` parameter.
- **Blind signing (security.js):** Implement RSA blind signatures per RFC 9474 yielding PS384.
- **Tests:** Add regression tests for each compliance area.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `poppy-session-signing`: delegation payload shape, `kid` naming, and removal of the non-existent `session` extension.
- `poppy-session-verify`: session `kid` verification, `ath` absence enforcement, and `Poppy-Version` header check.
- `poppy-conversation`: message schema, error status mapping, and request-id placement.
- `poppy-task-coverage`: skill types, excluded-task schema, skill-index shape, and digest verification.
- `poppy-oauth-signin`: client assertions, mandatory `iss` check, `prompt=consent`, protected-resource metadata location, and verification-URI host check.
- `poppy-discovery`: `scope_hints.changes` handling, version selection, issuer cross-check, and cross-field constraints.
- `poppy-extensions`: RFC 9651 header format.
- `poppy-security-hardening`: RSA blind signatures per RFC 9474.
- `poppy-api-integration`: `private_key_jwt` client assertion for MCP token requests.
- `poppy-agent-identity`: `client_id == fetch URL` validation.

## Impact

Affected modules: `src/tools/poppy/{session,verify,security,conversation,tasks,oauth,api,identity,discovery,extensions}.js`. No new dependencies. Tests in `tests/unit/` mirroring the poppy modules.

## Non-goals

- No changes to the Poppy tool's public API surface beyond spec-required payload shapes.
- No changes to unrelated tools or subsystems.
- No new external dependencies.
