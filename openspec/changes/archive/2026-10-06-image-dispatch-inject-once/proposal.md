## Why

The `ImageDispatch` middleware re-injects a `readImage` result as a multimodal HumanMessage on every model call while the ToolMessage remains in state, and it pairs the image with the most recent user prompt rather than the prompt that triggered the `readImage` call. The base64 payload also rides along as text in the ToolMessage, wasting context tokens.

## What Changes

- Inject the image only on the turn immediately following the `readImage` call, tracked by `tool_call_id`, so it is not re-attached to unrelated subsequent prompts.
- Pair the image with the prompt that triggered the `readImage` call (the HumanMessage preceding the AIMessage that made the call), not the most recent user prompt.
- Strip the base64 payload from the `readImage` ToolMessage content (replace with a short stub) so the model never receives it as plain text tokens.
- Add a regression test covering the two-turn scenario.

## Capabilities

### New Capabilities
<!-- None introduced -->

### Modified Capabilities
- `read-image-vision-dispatch`: The dispatch middleware now injects the image once (tracked by `tool_call_id`), pairs it with the triggering prompt, and strips the base64 payload from the ToolMessage content.

## Impact

- `src/provider/imageDispatchMiddleware.js` — the `wrapModelCall` loop that scans all messages and injects on every call.
- `src/tools/image/readImage.js` — returns base64 as a JSON string in the tool result text (the middleware now strips it before the model sees it).
- `tests/unit/provider/imageDispatchMiddleware.test.js` — extended with a two-turn regression test.
