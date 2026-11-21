# Proposal

## Why

Poppy extensions add optional features on top of the core Personal Agent Protocol. A company lists the extensions it offers in the `extensions` field of its `poppy.json`, and a personal agent declares the ones it uses in the `Poppy-Extensions` header. Supporting extensions lets madz work with companies that offer them, while ignoring unsupported ones. This builds on the existing Poppy tooling (issues 01-09).

## What Changes

- Add a `poppy` extension module at `src/tools/poppy/extensions.js` that:
  - Parses the `extensions` field from `poppy.json` (keyed by name, with version and endpoint per entry).
  - Sends the `Poppy-Extensions` header (RFC 9651 List of Strings) declaring the extensions madz uses with a company, one version each.
  - Handles `extension_required` (403) responses, which name the required extension.
  - Implements the core extensions: `browser-control`, `disclosures`, `links`, `mediated-sign-in`, `operations`, and `ucp`.
  - Ignores unknown extensions and versions.
- Register the `extensions` action in the `poppy` tool's `ACTIONS` registry and `poppySchema`.
- Add unit tests in `tests/unit/tools/poppy/extensions.test.js`.

## Capabilities

### New Capabilities
- `poppy-extensions`: Declaring and handling Poppy protocol extensions — parsing the `extensions` field from `poppy.json`, sending the `Poppy-Extensions` header, handling `extension_required` responses, and implementing the core extensions.

### Modified Capabilities
- `poppy-api-integration`: The `Poppy-Extensions` header construction is refined to emit a proper RFC 9651 List of Strings (one version per declared extension) rather than a raw JSON string.

## Impact

- **Code**: `src/tools/poppy/extensions.js` (new), `src/tools/poppy/index.js` (register action), `src/tools/poppy/api.js` (refine `buildHeaders`).
- **Tests**: `tests/unit/tools/poppy/extensions.test.js` (new).
- **Dependencies**: `jose` (v6.2.18, already present) for `mediated-sign-in` and `operations` signing if needed.
- **Security**: Extension content is validated against published JSON Schemas; treated as data, not instructions; secrets are never sent in extension content.

## Non-goals

- Implementing extension-specific server-side behaviors beyond declaring and handling the core extensions.
- Supporting extensions not in the core set (`browser-control`, `disclosures`, `links`, `mediated-sign-in`, `operations`, `ucp`).
- Changing the Poppy protocol version negotiation.
