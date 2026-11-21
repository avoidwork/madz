# Proposal

## Why

Poppy's security model is central to its trustworthiness. A personal agent must keep access tokens, refresh tokens, session JWTs, private keys, and codes out of model context; treat company content as data (not instructions); validate token and assertion audiences; and manage delegated keys and blind signing correctly. This hardens all the layers built in issues 01-10.

## What Changes

- Add a `poppy` security module at `src/tools/poppy/security.js` that:
  - Provides a secrets vault that keeps access/refresh tokens, session JWTs, private keys, authorization codes, PKCE verifiers, and device codes out of model context (section 10.2).
  - Marks company content (messages, API responses, web pages, skill content, alternatives) as data, never instructions (section 10.1).
  - Validates token and assertion audiences against the verified company identifier (section 10.4).
  - Manages delegated keys: one key per user ID, short delegations, rotation, and optional blind signing (RFC 9474) for client assertions and delegations.
  - Handles sign-in risks: cross-device flows, consent phishing, and `prompt=consent` enforcement (section 10.8).
- Wire the `security` action into the `poppy` tool's ACTIONS registry and schema in `src/tools/poppy/index.js`.
- Add unit tests under `tests/unit/tools/poppy/security.test.js` and an integration test under `tests/integration/tools/poppy/security.test.js`.

## Capabilities

### New Capabilities
- `poppy-security-hardening`: enforce Poppy security considerations — keep secrets out of model context, treat company content as data, validate audiences, and manage delegated keys and sign-in risks.

### Modified Capabilities
<!-- No existing spec-level behavior changes. -->

## Impact

- `src/tools/poppy/security.js` — new security module (secrets vault, content trust, audience validation, delegated-key registry, sign-in risk helpers).
- `src/tools/poppy/index.js` — register the `security` action in ACTIONS and the schema.
- `tests/unit/tools/poppy/security.test.js` — unit tests.
- `tests/integration/tools/poppy/security.test.js` — integration test.

## Non-goals

- No HTTP transport layer — the module provides helpers and the `security` action dispatcher.
- No changes to existing poppy actions beyond registering the new `security` action.
- No changes to other tools.
