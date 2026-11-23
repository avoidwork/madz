# Design

## Context

The Poppy tool in `src/tools/poppy/` was implemented against an earlier or partial understanding of the Personal Agent Protocol 1.0 spec. Multiple modules encode non-compliant payload shapes, status codes, header formats, and missing client-assertion/issuer checks. See proposal.md - Why for the motivation. The existing OpenSpec capabilities for each Poppy area already exist; this change refines their requirements to be spec-precise and updates the implementation to match.

## Goals / Non-Goals

**Goals:**
- Bring all ten Poppy modules into spec 1.0 compliance.
- Preserve the existing module boundaries and Zod-based validation patterns.
- Add regression tests for each compliance area.

**Non-Goals:**
- No changes to the Poppy tool's public API surface beyond spec-required payload shapes.
- No new external dependencies.
- No changes to unrelated tools or subsystems.

## Decisions

- **Delegation payload minimalism (session.js):** Remove `sub`/`aud` from delegation JWTs so the payload carries only `iss`, `cnf.jwk`, `iat`, `exp`, `jti`. This prevents leaking the User ID and Company issuer. The `kid` must name the signing key from `jwks_uri`. Alternative considered: keeping `sub`/`aud` for traceability — rejected because spec 5.2 forbids them.
- **Conversation message shape (conversation.js):** Replace `role`/`content` with the spec `author:{type}` + `text`/`data`/`context`/`extensions` shape. `requestId` moves into the POST body per spec 8.3. Error status mapping corrected to 409/409/410/409.
- **Tasks schema (tasks.js):** `VALID_SKILL_TYPES` becomes `skill-md`/`archive`; `ExcludedTaskSchema` becomes `task` (required) + `alternative` object; `skill_index` becomes the spec `{ "$schema", "skills": [...] }` shape; `fetchSkill` digest becomes SHA-256 of raw bytes prefixed `sha256:`; `task` capped at 200 chars.
- **OAuth client assertions (oauth.js, api.js):** Add `private_key_jwt` client assertions to device code request, device poll, revocation (with `token_type_hint=refresh_token` default), and MCP token requests. Make the Direct Sign-In `iss` check mandatory, require `prompt=consent` unless same-device, fetch protected-resource metadata from the domain host, and check the verification-URI host.
- **Discovery (discovery.js):** Treat unknown `scope_hints.changes` values as `irreversible`; accept newer minor versions from 1.0; add issuer/protected-resource cross-check; validate `supported_versions` URLs; resolve DNS in `isPrivateAddress`; enforce `web.disabled`/`auth.disabled` cross-field constraints.
- **Extensions header (extensions.js):** Emit RFC 9651 List of Strings with a `v` parameter.
- **Blind signing (security.js):** Implement RSA blind signatures per RFC 9474 yielding PS384.

## Risks / Trade-offs

- [Breaking existing delegation flows] → Keep tests green; the delegation payload change is additive to validation logic.
- [Breaking conversation flows] → Update message schema and error mapping together with tests.
- [Breaking auth flows] → Client assertions are additive; verify against the spec.
- [Discovery version selection change] → Accepting newer minor versions is backward-compatible for 1.0 agents.
