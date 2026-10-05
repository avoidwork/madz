## MODIFIED Requirements

### Requirement: Bearer token injection on model requests
The system SHALL inject `Authorization: Bearer <token>` on every Copilot model request via a custom fetch interceptor.

#### Scenario: Fetch interceptor adds bearer token
- **WHEN** `createCopilotFetch()` is used to make a request
- **THEN** the request includes `Authorization: Bearer <token>` read fresh from the auth file

#### Scenario: Model uses the interceptor
- **WHEN** a `github-copilot` provider is the active provider
- **THEN** `createChatModel` passes the custom fetch to `ChatOpenAI` and supplies a non-empty placeholder `apiKey` so the OpenAI SDK constructor's credential check passes, while the custom fetch interceptor injects the real bearer token

#### Scenario: Placeholder apiKey is not sent as Authorization header
- **WHEN** a `github-copilot` provider model is constructed with a custom fetch interceptor
- **THEN** the placeholder `apiKey` is never sent as the `Authorization` header; the custom fetch interceptor supplies `Authorization: Bearer <token>`

#### Scenario: Model constructs without OPENAI_API_KEY
- **WHEN** `createChatModel` builds a `github-copilot` model with `OPENAI_API_KEY` unset in the environment
- **THEN** the client is constructed without throwing `Missing credentials`
