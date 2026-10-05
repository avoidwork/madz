## Context

The GitHub Copilot provider authenticates via OAuth device flow (RFC 8628), persisting a bearer token to `memory/auth.json` with mode `0o600`. `createChatModel()` in `src/provider/openai.js` builds the Copilot model with `configuration.fetch = createCopilotFetch()` so the bearer token is injected on every request. However, the OpenAI SDK v7 `OpenAI` client constructor throws `Missing credentials` when no `apiKey`, `workloadIdentity`, or `adminAPIKey` is present — regardless of whether a custom `fetch` is supplied. Because the Copilot branch never sets `opts.apiKey`, the constructor throws before the custom fetch interceptor ever runs. This only manifests when `OPENAI_API_KEY` is unset in the environment (the deployed container).

## Goals / Non-Goals

**Goals:**
- Make the Copilot model path construct successfully with `OPENAI_API_KEY` unset.
- Ensure the custom fetch interceptor still injects the real bearer token; the placeholder `apiKey` is never sent as the Authorization header.
- Correct the misleading `CLIENT_ID` module comment in `src/provider/copilotAuth.js`.
- Add unit and integration tests covering the Copilot model path and bearer-token injection.

**Non-Goals:**
- No change to the non-Copilot (OpenAI API key) path in `createChatModel()`.
- No change to the `CLIENT_ID` value or the OAuth device flow implementation.
- No change to token persistence (`memory/auth.json`, mode `0o600`).
- No change to the custom fetch interceptor's bearer-token injection behavior.

## Decisions

### Decision 1: Pass a placeholder `apiKey` for the Copilot branch

The OpenAI SDK v7 `OpenAI` constructor requires a credential (`apiKey`, `workloadIdentity`, or `adminAPIKey`) even when a custom `fetch` is supplied. The Copilot branch passes `configuration.fetch = createCopilotFetch()` but never sets `opts.apiKey`, so the constructor throws `Missing credentials` before the interceptor runs.

**Decision:** In the Copilot branch of `createChatModel()`, set `opts.apiKey = "copilot"` (a non-empty placeholder). This satisfies the SDK's credential check. The custom fetch interceptor overrides the `Authorization` header on every request with the real bearer token, so the placeholder is never sent to the Copilot API.

**Alternatives considered:**
- `opts.apiKey = "not-needed"` — functionally equivalent; `"copilot"` is more descriptive and self-documenting.
- Passing `workloadIdentity` or `adminAPIKey` — these are semantically wrong for the Copilot path and would be misleading.
- Not passing any credential and relying on the custom fetch — this is the current broken behavior; the SDK throws before the fetch is used.

### Decision 2: Correct the `CLIENT_ID` module comment

The module comment in `src/provider/copilotAuth.js` claims the `CLIENT_ID` is "the same client id used by opencode". This is incorrect — the project uses its own app id. The comment is corrected to accurately describe the `CLIENT_ID` as the project's own app id.

**Decision:** Update the comment text only; do not change the `CLIENT_ID` value.

### Decision 3: Test the Copilot model path with `OPENAI_API_KEY` unset

The unit test must construct the Copilot model path with `OPENAI_API_KEY` unset and assert the client is created without throwing. It must also verify the custom fetch interceptor injects `Authorization: Bearer <token>`. Edge cases: token absent (no auth file), token expired (401 → re-auth handler fires), enterprise URL variant.

**Decision:** Add tests to `tests/unit/provider/openai.test.js` and `tests/unit/provider/copilotAuth.test.js` (the latter already covers `createCopilotFetch`). Add an integration test in `tests/integration/` mocking the Copilot API.

## Risks / Trade-offs

- [Placeholder `apiKey` could be sent as Authorization header] → Mitigation: The custom fetch interceptor (`createCopilotFetch`) overrides the `Authorization` header on every request with the real bearer token. The unit test verifies the placeholder is not sent as the Authorization header when a custom fetch is present.
- [Placeholder `apiKey` leaks into logs] → Mitigation: The placeholder `"copilot"` is a non-secret, non-sensitive constant. It is not a credential and is not logged.
- [Non-Copilot path regression] → Mitigation: The fix is scoped to the `isCopilot` branch only; the non-Copilot path is unchanged and covered by existing tests.
