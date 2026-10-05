## Why

The GitHub Copilot provider fails to authenticate after the OAuth device flow completes. Sending a message throws `Missing credentials` from the OpenAI SDK before any request is made, even though a valid token was persisted during the device flow. The root cause is that `createChatModel()` in `src/provider/openai.js` builds the Copilot model with `configuration.fetch = createCopilotFetch()` but never sets `apiKey`. The OpenAI SDK v7 `OpenAI` client constructor throws `Missing credentials` when no `apiKey`, `workloadIdentity`, or `adminAPIKey` is present — regardless of whether a custom `fetch` is supplied. This only manifests when `OPENAI_API_KEY` is unset in the environment (the deployed container).

## What Changes

- In `src/provider/openai.js`, pass a non-empty placeholder `apiKey` (e.g. `"copilot"`) to the OpenAI SDK constructor for the Copilot path so the credential check passes, while the custom `fetch` interceptor supplies the real bearer token.
- In `src/provider/copilotAuth.js`, correct the module comment that incorrectly claims the `CLIENT_ID` is "the same client id used by opencode" — the project uses its own app id.
- Add unit tests in `tests/unit/provider/openai.test.js` that construct the Copilot model path with `OPENAI_API_KEY` unset and assert the client is created without throwing, and verify the custom fetch interceptor injects `Authorization: Bearer <token>`.
- Add an integration test in `tests/integration/` mocking the Copilot API verifying a request carries the bearer token header.

## Capabilities

### New Capabilities
<!-- None — this is a fix to an existing capability. -->

### Modified Capabilities
- `github-copilot-provider`: The "Model uses the interceptor" scenario currently states that `createChatModel` "omits `apiKey`". This is incorrect — the fix passes a placeholder `apiKey` to satisfy the OpenAI SDK constructor's credential check while the custom fetch interceptor supplies the real bearer token. The requirement must be updated to reflect that the Copilot model path passes a placeholder `apiKey` and that the placeholder is never sent as the Authorization header when a custom fetch is present.

## Impact

- `src/provider/openai.js` — `createChatModel()` Copilot branch adds a placeholder `apiKey`.
- `src/provider/copilotAuth.js` — module comment correction only.
- `tests/unit/provider/openai.test.js` — new unit tests for the Copilot model path.
- `tests/integration/` — new integration test mocking the Copilot API.
- `openspec/specs/github-copilot-provider/spec.md` — delta spec for the modified requirement.

## Non-goals

- No change to the non-Copilot (OpenAI API key) path in `createChatModel()`.
- No change to the `CLIENT_ID` value or the OAuth device flow implementation.
- No change to token persistence (`memory/auth.json`, mode `0o600`).
- No change to the custom fetch interceptor's bearer-token injection behavior.
