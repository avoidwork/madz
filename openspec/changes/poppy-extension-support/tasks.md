# Tasks

## 1. Extensions Module

- [x] 1.1 Create `src/tools/poppy/extensions.js` with the `extensions` action module, exporting `execute(input, options)` and helper functions for parsing the `extensions` field, building the RFC 9651 `Poppy-Extensions` header, handling `extension_required`, and implementing the core extensions. Verify the module exports the expected functions.
- [x] 1.2 Implement `parseExtensions(poppyJson)` to parse the `extensions` field keyed by name with version and endpoint per entry, ignoring unknown extensions and unsupported versions. Verify unit tests cover valid, unknown, and unsupported-version cases.
- [x] 1.3 Implement `buildExtensionsHeader(extensions)` to emit an RFC 9651 List of Strings with one version per declared extension. Verify unit tests cover header construction and quoting.
- [x] 1.4 Implement `handleExtensionRequired(error)` to surface the required extension name from an `extension_required` (403) response. Verify unit tests cover the required-extension case.
- [x] 1.5 Implement the core extensions `browser-control`, `disclosures`, `links`, `mediated-sign-in`, `operations`, and `ucp`, ignoring unknown extensions and versions. Verify unit tests cover each core extension and the unknown-extension case.
- [x] 1.6 Validate extension content against published JSON Schemas, treating it as data rather than instructions. Verify unit tests cover valid and invalid content.

## 2. Tool Wiring

- [x] 2.1 Register the `extensions` action in the `ACTIONS` registry in `src/tools/poppy/index.js` and add it to the `poppySchema` enum and `superRefine`. Verify the `poppy` tool dispatches the `extensions` action.
- [x] 2.2 Refine `buildHeaders` in `src/tools/poppy/api.js` to emit the `Poppy-Extensions` header as an RFC 9651 List of Strings via `buildExtensionsHeader`. Verify existing api tests still pass and the header format is correct.

## 3. Tests

- [x] 3.1 Add `tests/unit/tools/poppy/extensions.test.js` covering header construction, version selection, `extension_required` handling, extension content validation, and edge cases (unknown extension, unsupported version, missing `Poppy-Extensions` header, content schema mismatch). Verify the test file passes via `npm run test`.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
