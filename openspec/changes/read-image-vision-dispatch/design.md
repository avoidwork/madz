## Context

The madz harness registers tools in `src/tools/index.js` and exposes them to the agent. The `readImage` tool (`src/tools/image/readImage.js`) reads a local image and returns `{ ok, mimeType, data }` as JSON, where `data` is base64-encoded image bytes and `mimeType` is detected via `detectMimeType()`. However, there is no mechanism to dispatch that image into the LLM conversation as a vision input. The `readImage` result sits in the message history as a ToolMessage but is never converted into a multimodal HumanMessage that the model can consume.

This change adds that dispatch mechanism. It follows the existing `wrapModelCall` middleware pattern established by `TokenBudget` (`src/provider/tokenBudgetMiddleware.js`) and `Summarization` (`src/provider/summarizationMiddleware.js`), both of which use `createMiddleware({ name, wrapModelCall })` from `langchain`.

## Goals / Non-Goals

**Goals:**
- Add a `sendImage` content-builder tool at `src/tools/image/sendImage.js` that produces a multimodal content array from `{ data, mimeType, text }`.
- Add a `wrapModelCall` middleware at `src/provider/imageDispatchMiddleware.js` that observes a `readImage` ToolMessage, builds a multimodal HumanMessage, and injects it into `request.messages`.
- Register the middleware in `src/agent/deepAgents.js`'s `createDeepAgent` middleware array.
- Add unit tests for `sendImage` and the middleware, plus an integration test.

**Non-Goals:**
- Image generation (covered by `generateImage`).
- Image analysis/description — the middleware only dispatches bytes; the LLM does the analysis.
- Downscaling or compression of large images.
- Registering `sendImage` as a callable tool in `ORCHESTRATOR_TOOLS`/`TOOLS`.

## Decisions

### Decision 1: `sendImage` is a content-builder, not a registered tool
`sendImage` is a pure helper that builds a multimodal content array. It is NOT added to `ORCHESTRATOR_TOOLS` or `TOOLS` in `src/tools/index.js`. The dispatch middleware reuses its content-building logic. This keeps the tool layer unchanged and avoids exposing a non-actionable tool to the model. Alternatives (registering it as a callable tool) were rejected because `sendImage` has no side effects — it only transforms data already in the conversation.

### Decision 2: Middleware only reacts to `readImage`, not `sendImage`
The dispatch middleware scans `request.messages` for ToolMessages whose `name` is `readImage`. It does not react to `sendImage` results. This prevents double-dispatch and keeps the middleware narrowly scoped to the issue's requirement.

### Decision 3: MIME defaulting to `image/png`
When the parsed `mimeType` is unknown or absent, the content-builder defaults to `image/png`. This matches the issue's edge-case requirement and ensures a valid data URI is always constructed.

### Decision 4: Middleware ordering in `createDeepAgent`
The middleware is registered AFTER summarization and BEFORE token-budget. `AgentNode` composes the `wrapModelCall` chain backwards, so the LAST entry is innermost. Registering after summarization means the middleware observes the final (post-summarization) message set; registering before token-budget means the budget sees the injected image when estimating context cost.

### Decision 5: Inject a HumanMessage paired with the user's prompt
The middleware builds a multimodal content array with a text block (the user's prompt that triggered the `readImage` call) plus an `image_url` block carrying `data:<mimeType>;base64,<data>`. It injects this as a HumanMessage into `request.messages`. Multiple `readImage` results in one turn produce multiple image blocks in a single HumanMessage.

## Risks / Trade-offs

- **Large images** → Mitigated by the existing `image.maxSize` cap in `readImage`; the middleware only dispatches what `readImage` already returned.
- **Malformed tool result JSON** → The middleware parses the ToolMessage content defensively; if parsing fails or `ok` is `false`, it skips that result.
- **Missing/empty `data`** → The content-builder rejects missing/empty `data`, so the middleware skips such results.
- **Unknown MIME type** → Defaults to `image/png`, ensuring a valid data URI.
- **Middleware ordering** → Registered after summarization and before token-budget so both the final message set and the injected image are observed correctly.
