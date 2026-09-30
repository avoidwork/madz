## Why

After the `readImage` tool reads an image and returns base64 data, there is no mechanism to dispatch that image into the LLM conversation as a vision input. This change adds a harness-side mechanism that takes the `readImage` result and sends it to the model as a multimodal HumanMessage, paired with the user's original prompt.

## What Changes

- Add a `sendImage` tool at `src/tools/image/sendImage.js` that builds a multimodal content array `[{ type: "text", text }, { type: "image_url", image_url: { url: "data:<mime>;base64,<data>" } }]` from `{ data, mimeType, text }`. It validates `mimeType` against a known image MIME set via a Zod schema, defaulting to `image/png` when unknown/absent, and rejects missing/empty `data`.
- Add a `wrapModelCall` middleware at `src/provider/imageDispatchMiddleware.js` that observes a `readImage` ToolMessage in `request.messages`, parses the tool result JSON (`{ ok, mimeType, data }`), builds a multimodal content array using `sendImage`'s content-building logic, and injects a HumanMessage with that content into `request.messages` before invoking the handler.
- Register the middleware in `src/agent/deepAgents.js`'s `createDeepAgent` middleware array, before the token-budget middleware and after summarization.

## Capabilities

### New Capabilities
- `read-image-vision-dispatch`: Dispatching a `readImage` tool result into the LLM conversation as a multimodal vision input, paired with the user's original prompt.

### Modified Capabilities
<!-- None — no existing spec-level behavior changes. -->

## Impact

- **`src/tools/image/sendImage.js`** — new content-builder tool.
- **`src/provider/imageDispatchMiddleware.js`** — new `wrapModelCall` middleware.
- **`src/agent/deepAgents.js`** — register the middleware in the `middleware: [...]` array.
- **`tests/unit/tools/image/sendImage.test.js`** — new unit tests.
- **`tests/unit/provider/imageDispatchMiddleware.test.js`** — new unit tests.
- **`tests/integration/`** — new integration test simulating a user prompt that triggers `readImage`.

## Non-goals

- Image generation (already covered by `generateImage`).
- Image analysis/description — the middleware only dispatches bytes; the LLM does the analysis.
- Downscaling or compression of large images.
- Registering `sendImage` as a callable tool in the orchestrator (`ORCHESTRATOR_TOOLS`/`TOOLS`).
