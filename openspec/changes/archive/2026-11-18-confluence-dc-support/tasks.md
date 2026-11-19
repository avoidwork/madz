# Tasks

## 1. Config schema

- [x] 1.1 Add `api` mode (`cloud` | `dc`, default `cloud`) to `ConfluenceSchema` in `src/config/schemas/confluence.js`, and verify it parses both modes and defaults to `cloud`

## 2. Mode-aware request building

- [x] 2.1 Rewrite `buildRequest` in `src/tools/confluence/index.js` to select the API base path and request/response shapes by mode, and verify the DC endpoints via unit tests (content, search, space, label, attachment)

## 3. Response validation

- [x] 3.1 Add non-JSON response rejection and login-redirect detection in `confluenceImpl`, and verify via unit tests that an HTML response and a login redirect both return `ok: false`

## 4. Search endpoint fix

- [x] 4.1 Fix the `search` action to use the correct search endpoint per mode (cloud `/wiki/rest/api/search`, dc `/rest/api/search`), and verify via unit tests

## 5. Config and description

- [x] 5.1 Document `confluence.api` in `config.yaml` and update the tool description, and verify the description text is present

## 6. Integration coverage

- [x] 6.1 Extend the integration mock and add a DC-mode lifecycle test, and verify the DC lifecycle passes

## 7. Verification

- [x] 7.1 Run `npm run lint` and the full test suite, and verify all pass

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
