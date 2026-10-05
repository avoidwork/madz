## 1. Fix root cause in openai.js

- [ ] 1.1 In `src/provider/openai.js`, add a non-empty placeholder `apiKey` (e.g. `"copilot"`) to the Copilot branch of `createChatModel()` so the OpenAI SDK constructor's credential check passes.
- [ ] 1.2 Verify the placeholder `apiKey` is not sent as the `Authorization` header when a custom fetch interceptor is present.

## 2. Correct CLIENT_ID comment in copilotAuth.js

- [ ] 2.1 In `src/provider/copilotAuth.js`, update the module comment to accurately describe the `CLIENT_ID` as the project's own app id, not opencode's.

## 3. Add unit tests for the Copilot model path

- [ ] 3.1 Add a unit test in `tests/unit/provider/openai.test.js` that constructs the Copilot model path with `OPENAI_API_KEY` unset and asserts the client is created without throwing.
- [ ] 3.2 Add a unit test verifying the custom fetch interceptor injects `Authorization: Bearer <token>`.
- [ ] 3.3 Add edge-case unit tests: token absent (no auth file), token expired (401 → re-auth handler fires), enterprise URL variant.

## 4. Add integration test mocking the Copilot API

- [ ] 4.1 Add an integration test in `tests/integration/` mocking the Copilot API verifying a request carries the `Authorization: Bearer <token>` header.

## 5. Verify

- [ ] 5.1 Run `npm run lint` and `npm run test`; fix any failures.
