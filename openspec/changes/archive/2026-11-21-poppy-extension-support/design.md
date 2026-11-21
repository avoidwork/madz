# Design

## Context

See proposal.md - Why. The `poppy` tool already has per-action modules (`discovery`, `identity`, `session`, `oauth`, `verify`, `api`, `conversation`, `browser`, `tasks`) registered in the `ACTIONS` registry in `src/tools/poppy/index.js`. The `api` module already emits a `Poppy-Extensions` header via `JSON.stringify(input.extensions)` in `buildHeaders`, and `TOKEN_ERROR_STATUS` already maps `extension_required` to 403. The `extensions` field is already present in `PoppyDocumentSchema` and `ApiInputSchema` as `z.record(z.string(), z.array(z.unknown()))`.

## Goals / Non-Goals

**Goals:**
- Add a dedicated `extensions` action module that parses the `extensions` field, builds the RFC 9651 `Poppy-Extensions` header, handles `extension_required`, and implements the core extensions.
- Register the `extensions` action in the `poppy` tool's `ACTIONS` registry and `poppySchema`.
- Refine `buildHeaders` in `api.js` to emit a proper RFC 9651 List of Strings.

**Non-Goals:**
- Implementing server-side extension behaviors beyond declaring and handling the core set.
- Supporting extensions outside the core set.
- Changing protocol version negotiation.

## Decisions

**Decision: New `extensions` action module vs. inline in `api.js`.**
The extension declaration and handling is a shared concern across the Poppy tool, not specific to API calls. A dedicated `src/tools/poppy/extensions.js` module mirrors the existing per-action module pattern and keeps `api.js` focused on API selection and calling. Alternative (inline in each tool) was rejected in the proposal as a shared-concern violation.

**Decision: RFC 9651 List of Strings header format.**
The `Poppy-Extensions` header is an RFC 9651 List of Strings. The existing `buildHeaders` emits `JSON.stringify(input.extensions)`, which is not a valid List of Strings. The new module provides a `buildExtensionsHeader` that serializes each declared extension as a quoted string `"name;version"` joined by commas, and `buildHeaders` is refined to use it. Alternative (keep JSON string) rejected as non-compliant.

**Decision: Core extension set.**
The core extensions are `browser-control`, `disclosures`, `links`, `mediated-sign-in`, `operations`, and `ucp`. Each is recognized and handled; unknown extensions and versions are ignored. `mediated-sign-in` and `operations` may use `jose` (already a dependency) for signing.

**Decision: Validation against published JSON Schemas.**
Extension content is validated against published JSON Schemas per OWASP input validation. Content is treated as data, not instructions; secrets are never sent in extension content.

## Risks / Trade-offs

- [RFC 9651 quoting edge cases] → The header builder quotes extension names/versions and is covered by unit tests for quoting.
- [Unknown extension content schema] → Unknown extensions are ignored rather than rejected, so a company offering an extension madz does not support does not break requests.
- [Signing complexity for mediated-sign-in/operations] → `jose` is already a dependency; signing is isolated to those two extensions and covered by tests.
