## ADDED Requirements

### Requirement: Build multimodal content from image data
The system SHALL provide a `sendImage` content-builder that constructs a multimodal content array `[{ type: "text", text }, { type: "image_url", image_url: { url: "data:<mimeType>;base64,<data>" } }]` from `{ data, mimeType, text }`, where `data` is base64-encoded image bytes and `mimeType` is the detected image MIME type.

#### Scenario: Successful content construction
- **WHEN** `sendImage` is invoked with valid `{ data, mimeType, text }`
- **THEN** it returns a content array with a text block containing `text` and an `image_url` block whose `url` is `data:<mimeType>;base64,<data>`

#### Scenario: Unknown MIME type defaults to image/png
- **WHEN** `sendImage` is invoked with an unknown or absent `mimeType`
- **THEN** it defaults the MIME type to `image/png` and constructs the data URI accordingly

#### Scenario: Missing or empty data is rejected
- **WHEN** `sendImage` is invoked with missing or empty `data`
- **THEN** it rejects the input via schema validation

### Requirement: Dispatch readImage result to LLM as vision input
The system SHALL provide a `wrapModelCall` middleware that observes a `readImage` ToolMessage in `request.messages`, parses the tool result JSON (`{ ok, mimeType, data }`), builds a multimodal content array, and injects a HumanMessage with that content into `request.messages` before invoking the handler.

#### Scenario: readImage ToolMessage triggers dispatch
- **WHEN** a `readImage` ToolMessage is present in `request.messages`
- **THEN** the middleware injects a HumanMessage with a text block (the user's prompt) and an `image_url` block carrying `data:<mimeType>;base64,<data>` before invoking the handler

#### Scenario: ok:false result is skipped
- **WHEN** a `readImage` ToolMessage result has `ok: false`
- **THEN** the middleware skips that result and does not inject an image block

#### Scenario: Multiple readImage results in one turn
- **WHEN** multiple `readImage` ToolMessages are present in `request.messages`
- **THEN** the middleware injects a HumanMessage with multiple image blocks, one per successful result

#### Scenario: No readImage messages is a no-op
- **WHEN** no `readImage` ToolMessage is present in `request.messages`
- **THEN** the middleware invokes the handler without modifying `request.messages`

### Requirement: Register image dispatch middleware in orchestrator
The system SHALL register the image dispatch middleware in the `createDeepAgent` middleware array, after the summarization middleware and before the token-budget middleware.

#### Scenario: Middleware is registered in the correct order
- **WHEN** the orchestrator is created
- **THEN** the image dispatch middleware is present in the `middleware` array after summarization and before token-budget
