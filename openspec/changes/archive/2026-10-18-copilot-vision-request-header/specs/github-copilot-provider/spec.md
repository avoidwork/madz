## MODIFIED Requirements

### Requirement: Bearer token injection on model requests
The system SHALL inject `Authorization: Bearer <short-lived-token>` on every Copilot model request via a custom fetch interceptor, after exchanging the OAuth device-flow token for a short-lived API bearer at `copilot_internal/v2/token`.

#### Scenario: Fetch interceptor adds exchanged bearer token
- **WHEN** `createCopilotFetch()` is used to make a request
- **THEN** the request includes `Authorization: Bearer <short-lived-token>` (the exchanged bearer), read fresh from the exchange cache, not the raw OAuth token

#### Scenario: Model uses the interceptor
- **WHEN** a `github-copilot` provider is the active provider
- **THEN** `createChatModel` passes the custom fetch to `ChatOpenAI` and supplies a non-empty placeholder `apiKey` so the OpenAI SDK constructor's credential check passes, while the custom fetch interceptor injects the real exchanged bearer token

#### Scenario: Placeholder apiKey is not sent as Authorization header
- **WHEN** a `github-copilot` provider model is constructed with a custom fetch interceptor
- **THEN** the placeholder `apiKey` is never sent as the `Authorization` header; the custom fetch interceptor supplies `Authorization: Bearer <short-lived-token>`

#### Scenario: Model constructs without OPENAI_API_KEY
- **WHEN** `createChatModel` builds a `github-copilot` model with `OPENAI_API_KEY` unset in the environment
- **THEN** the client is constructed without throwing `Missing credentials`

#### Scenario: Initiator header reflects the last message
- **WHEN** the last message in the body is not a plain user text message
- **THEN** `x-initiator` is `agent`, otherwise `user`

#### Scenario: Synthetic image attachment is agent-initiated
- **WHEN** the last message is a user message carrying the synthetic-attachment sentinel
- **THEN** `x-initiator` is `agent`

#### Scenario: Standard Copilot headers are set
- **WHEN** any Copilot model request is made
- **THEN** `Openai-Intent` is `conversation-edits`, `X-GitHub-Api-Version` is the configured API version, and `User-Agent` is prefixed with the application name and version

#### Scenario: Vision header is set for image payloads
- **WHEN** the request body contains image content in any message
- **THEN** the outgoing request carries `Copilot-Vision-Request: true`

#### Scenario: Vision header is omitted for text payloads
- **WHEN** the request body contains no image content
- **THEN** the outgoing request carries no `Copilot-Vision-Request` header

#### Scenario: Re-auth on 401
- **WHEN** a request returns 401 and a token was sent
- **THEN** the stored token is cleared and the registered auth-required handler is invoked
