## MODIFIED Requirements

### Requirement: Dispatch readImage result to LLM as vision input
The system SHALL provide a `wrapModelCall` middleware that observes a `readImage` ToolMessage in `request.messages`, parses the tool result JSON (`{ ok, mimeType, data }`), builds a multimodal content array, and injects a HumanMessage with that content into `request.messages` before invoking the handler. The image SHALL be injected only on the turn immediately following the `readImage` call (tracked by `tool_call_id`), SHALL be paired with the prompt that triggered the `readImage` call rather than the most recent user prompt, and SHALL strip the base64 payload from the ToolMessage content so the model never receives it as plain text tokens.

#### Scenario: readImage ToolMessage triggers dispatch
- **WHEN** a `readImage` ToolMessage is present in `request.messages` and has not yet been dispatched
- **THEN** the middleware injects a HumanMessage with a text block (the triggering prompt) and an `image_url` block carrying `data:<mimeType>;base64,<data>` before invoking the handler

#### Scenario: Image is injected only once
- **WHEN** a `readImage` ToolMessage that was already dispatched on a prior turn is present in `request.messages`
- **THEN** the middleware does not inject a new image block for that `tool_call_id`

#### Scenario: Image is paired with the triggering prompt
- **WHEN** a `readImage` ToolMessage is dispatched and a later unrelated HumanMessage is present in `request.messages`
- **THEN** the injected text block uses the prompt that triggered the `readImage` call, not the most recent user prompt

#### Scenario: Base64 payload is stripped from the ToolMessage
- **WHEN** a `readImage` ToolMessage is dispatched
- **THEN** the ToolMessage content passed to the model is replaced with a short stub (e.g., "Image read successfully.") rather than the base64 payload

#### Scenario: ok:false result is skipped
- **WHEN** a `readImage` ToolMessage result has `ok: false`
- **THEN** the middleware skips that result and does not inject an image block

#### Scenario: Multiple readImage results in one turn
- **WHEN** multiple `readImage` ToolMessages are present in `request.messages`
- **THEN** the middleware injects a HumanMessage with multiple image blocks, one per successful result

#### Scenario: No readImage messages is a no-op
- **WHEN** no `readImage` ToolMessage is present in `request.messages`
- **THEN** the middleware invokes the handler without modifying `request.messages`
