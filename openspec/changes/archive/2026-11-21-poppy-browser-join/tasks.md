# Tasks

## 1. Browser Join Module

- [x] 1.1 Create `src/tools/poppy/browser.js` with `BrowserInputSchema` (Zod) requiring `op` and `endpoint`, and an `execute(input, options)` dispatcher, and verify the module imports cleanly
- [x] 1.2 Implement the join flow: load the `browser_session_endpoint` in the agent's browser, read the one-time code from the page, authorize it via `POST {endpoint}/authorize`, submit the form to set the session cookie, and browse the website with the cookie, and verify via unit tests
- [x] 1.3 Enforce the `poppy:browser-sign-in` scope and handle `web.disabled` / `web.unscoped`, and verify via unit tests
- [x] 1.4 Ensure the access token is only sent in the authorize request headers, never through the browser, and verify via unit tests

## 2. Tool Registry Integration

- [x] 2.1 Register the `browser` action in `src/tools/poppy/index.js` (ACTIONS, poppySchema enum, superRefine, description), and verify the poppy tool schema validates a `browser` action

## 3. Tests

- [x] 3.1 Add `tests/unit/tools/poppy/browser.test.js` covering code authorization, cookie handling, scope enforcement, and edge cases (expired code, already-authorized, missing scope, web.disabled, web.unscoped), and verify the unit tests pass
- [x] 3.2 Add `tests/integration/tools/poppy/browser.test.js` running the join flow against a mock browser-session endpoint, and verify the integration test passes

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
