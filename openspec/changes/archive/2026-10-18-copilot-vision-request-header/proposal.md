## Why

GitHub Copilot rejects any request whose payload contains an image unless the request carries a `Copilot-Vision-Request: true` header. Without it the API returns `400 {"error":{"message":"missing required Copilot-Vision-Request header for vision requests"}}`. Our Copilot fetch interceptor (`createCopilotFetch` in `src/provider/copilotAuth.js`) set `Authorization`, `x-initiator`, `Openai-Intent`, `X-GitHub-Api-Version`, and `User-Agent` — but never the vision marker. The result: `readImage` results dispatched as vision input by the `ImageDispatch` middleware never reached Copilot models, and Copilot's Anthropic models (which route through the `/v1/messages` shim, where the check is strictly enforced) were the most visible casualty.

opencode sets this header in its Copilot auth loader (`packages/opencode/src/plugin/github-copilot/copilot.ts`) and scans the **whole** request body for image content, not just the final message. Our existing `isAgentInitiated()` inspects only the last message, so a naive port of that pattern would have broken the moment an image scrolled out of the tail position.

## What Changes

- Add `isVisionRequest(body)` to `src/provider/copilotAuth.js`, which detects image content anywhere in the request body across all three Copilot API shapes.
- Add `hasImageParts(content)`, which recurses into Anthropic `tool_result` blocks so images nested in tool output are detected.
- Have `createCopilotFetch()` set `Copilot-Vision-Request: true` whenever `isVisionRequest()` returns true.
- Add unit tests covering all three API shapes, nested `tool_result` images, images outside the final message, and the negative cases.

## Capabilities

### New Capabilities
- `copilot-vision-request-header`: Detection of image content in Copilot request bodies and the corresponding `Copilot-Vision-Request` header, across the Completions, Responses, and Anthropic Messages API shapes.

### Modified Capabilities
- `github-copilot-provider`: The request interceptor now emits a vision routing marker on image-bearing requests, in addition to the existing auth and initiator headers.

## Impact

- `src/provider/copilotAuth.js` — `isVisionRequest()`, `hasImageParts()`, `VISION_PART_TYPES`, and one header set in `createCopilotFetch()`.
- `tests/unit/provider/copilotAuth.test.js` — new `Copilot-Vision-Request header` suite (10 tests).
- No config schema changes, no new dependencies, no changes to `ImageDispatch` or `sendImage` — the multimodal payload they build was already correct.

## Non-goals

- No change to how image blocks are constructed. `sendImageImpl`'s `image_url` data-URI shape and the `ImageDispatch` middleware's synthetic HumanMessage are correct as-is; only the header was missing.
- No per-model capability gating. The header is a routing hint, not a capability toggle, so it is sent whenever image content is present regardless of whether the target model advertises vision.
- No other Copilot-specific headers opencode sends (`X-Interaction-Id`, `X-Interaction-Type`, `anthropic-beta: interleaved-thinking-2025-05-14`, `eager_input_streaming` opt-out). Those are tracked separately.
- No change to `x-initiator` classification.
