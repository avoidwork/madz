# Design

## Context

See proposal.md - Why. The Poppy feature set (issues 01-10) already provides discovery, agent identity, session signing, session verification, OAuth sign-in, API integration, conversation, browser join, task coverage, and extension support. This change adds the security layer that enforces the protocol's security considerations across those modules. The existing modules follow a consistent pattern: each exports an `execute(input, options)` returning `{ok, data?, error?}`, a Zod input schema, and is registered in the `ACTIONS` registry and `poppySchema` enum in `src/tools/poppy/index.js`.

## Goals / Non-Goals

- **Goals:** Provide a `security` action module that keeps secrets out of model context, treats company content as data, validates audiences, manages delegated keys (isolation, rotation, blind signing), and handles sign-in risks.
- **Non-Goals:** No HTTP transport. No changes to existing poppy actions beyond registering the new `security` action. No changes to other tools.

## Decisions

### Secrets vault (section 10.2)
- **Decision:** Implement an in-memory `Vault` class with an injectable backing store, exposing `set`, `get`, `delete`, `rotate`, and `has`. A `redact` helper is the single choke point that strips known secret values from any payload before it is returned to the model.
- **Rationale:** An injectable store keeps the module testable and lets callers supply a durable store without changing the interface. The `redact` choke point guarantees secrets never leak into tool output.
- **Alternatives considered:** Persisting secrets to disk by default — rejected because it risks leaking secrets into config files and complicates cleanup.

### Content trust (section 10.1)
- **Decision:** Provide `markAsData`/`isData` that tag content with non-enumerable metadata, and `sanitizeContent` that neutralizes instruction-like markers conservatively.
- **Rationale:** Non-enumerable metadata keeps serialization unchanged while allowing consumers to distinguish data from instructions. Conservative sanitization avoids corrupting legitimate company content.
- **Alternatives considered:** Aggressive stripping of all markers — rejected as it could corrupt legitimate content.

### Audience validation (section 10.4)
- **Decision:** Provide `validateAudience(aud, expectedAud)` returning `{ok, error?}`, consistent with the poppy module convention.
- **Rationale:** Reuses the existing `{ok, error?}` result shape used across poppy modules.
- **Alternatives considered:** Throwing exceptions — rejected for consistency with the module convention.

### Delegated-key management
- **Decision:** Provide a `DelegatedKeyRegistry` binding one key per user ID, `rotateDelegatedKey`, and optional blind signing (RFC 9474) via `jose`.
- **Rationale:** `jose` is already a dependency (v6.2.18) and supports the required key operations. Strict per-user isolation and rotation address the leaked-key and key-isolation concerns.
- **Alternatives considered:** Reusing the existing `session.js` delegation logic directly — rejected because the security module needs additional isolation and rotation semantics.

### Sign-in risks (section 10.8)
- **Decision:** Provide `enforcePromptConsent` and `detectConsentPhishing` helpers.
- **Rationale:** These are pure validation helpers that integrate with the existing oauth flow without coupling to transport.
- **Alternatives considered:** Embedding in oauth.js — rejected to keep the security concerns centralized.

## Risks / Trade-offs

- [In-memory vault loses secrets on restart] → Backing store is injectable so callers can supply persistence.
- [Over-aggressive content sanitization corrupts legitimate content] → Sanitization is conservative and only neutralizes known instruction-like markers.
- [Blind signing adds complexity] → It is optional and gated behind a flag so flows that do not need it are unaffected.

## Migration Plan

- No migration required; this is a new capability. The `security` action is additive to the `poppy` tool.

## Open Questions

None.
