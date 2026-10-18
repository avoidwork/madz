## Context

The `ImageDispatch` middleware (`src/provider/imageDispatchMiddleware.js`) converts a `readImage` `ToolMessage` into a synthetic multimodal `HumanMessage` carrying an `image_url` data-URI block, and `sendImageImpl` (`src/tools/image/sendImage.js`) builds that block. Both were correct. The failure was one level down: the Copilot fetch interceptor in `src/provider/copilotAuth.js` never told GitHub the request was a vision request, and GitHub's API treats that omission as a hard validation error rather than a graceful degradation.

The reference implementation is opencode's Copilot plugin, `packages/opencode/src/plugin/github-copilot/copilot.ts`. Its auth loader computes `isVision` from the parsed request body and sets `headers["Copilot-Vision-Request"] = "true"` when true. Critically, it scans **every** message in the body, and it handles three distinct API shapes because Copilot serves different models over different wire formats.

That three-shape requirement is the crux. Copilot's model catalog advertises `supported_endpoints`, and opencode routes a model to `@ai-sdk/anthropic` against `${base}/v1` when it supports `/v1/messages`, otherwise to its OpenAI-compatible chat or responses client. madz sends everything through `ChatOpenAI`'s Completions path today, but the interceptor is shared and shape-agnostic — it inspects whatever body arrives — so detection must cover all three to be correct for the Anthropic models that are the subject of this fix.

## Goals / Non-Goals

**Goals:**
- Send `Copilot-Vision-Request: true` on every Copilot request whose payload contains image content.
- Detect image content across all three Copilot API shapes: Completions (`image_url`), Responses (`input_image`), Anthropic Messages (`image`, including images nested in `tool_result`).
- Scan the entire body, not just the final message.
- Never throw from the interceptor on a malformed or unparseable body.

**Non-Goals:**
- No change to image block construction — `sendImageImpl` and `ImageDispatch` are correct.
- No per-model vision-capability gating.
- No other Copilot headers opencode sends (`X-Interaction-Id`, `X-Interaction-Type`, `anthropic-beta`, `eager_input_streaming` opt-out).
- No change to `x-initiator` classification or the synthetic-attachment sentinel logic.

## Decisions

### Decision 1: Detect from the request body in the fetch interceptor, not in middleware
The header is set in `createCopilotFetch()`, which is passed to `ChatOpenAI` as `configuration.fetch`. This is the seam that already owns every other Copilot-specific header, and — per the `langchain_bindtools_orphan_patch` lesson — it survives `bindTools()` because it is a configuration value captured by the client, not an instance property on the model. Alternative (rejected): a `wrapModelCall` middleware would see `request.messages` in LangChain's message objects rather than the serialized wire body, so it would have to re-derive the exact shape the SDK is about to send — duplicating serialization logic and drifting from it.

### Decision 2: Scan the whole body, not the last message
opencode checks `body.messages.some(...)` / `body.input.some(...)`. An image injected on turn N is still present in the conversation on turns N+1, N+2, and GitHub still validates it. Our `isAgentInitiated()` reads only the final element, so copying that pattern would have produced a fix that worked on the first vision turn and silently failed on every subsequent one. Alternative (rejected): last-message-only detection — matches the existing `x-initiator` heuristic but is wrong for vision.

### Decision 3: Match part `type` against a frozen set of three values
`VISION_PART_TYPES = Object.freeze(new Set(["image_url", "input_image", "image"]))`. One set, three shapes, no branching on which API is in use — the body's own part types are self-identifying. Alternative (rejected): branching on URL path (`/v1/messages` vs `/chat/completions`) as opencode's loader partly does. The path is not reliably available to us for the Responses API, and the part types are sufficient and simpler.

### Decision 4: Recurse into `tool_result` content
Anthropic `tool_result` blocks can nest image blocks in their own `content` array. opencode handles this explicitly. `hasImageParts()` recurses one level through `tool_result` so a tool-produced image is detected. Alternative (rejected): ignoring nesting — would miss exactly the `readImage`-via-tool-result case this fix exists for, once Copilot's Anthropic models carry tool results containing images.

### Decision 5: Send the header unconditionally when image content is present
No check against a model's advertised vision capability. The header is a routing hint used by GitHub's edge to select the vision-capable path, not a capability assertion, so sending it for a non-vision model is harmless — the request fails on the payload regardless. Erring toward setting it avoids a class of "works for model A, silently broken for model B" bugs. Alternative (rejected): gating on `capabilities.supports.vision` from model discovery — adds a discovery dependency to a header that costs nothing to send.

### Decision 6: Tolerate a non-JSON or pre-parsed body
The interceptor already guards `JSON.parse` with a try/catch that sets `body = undefined`. `isVisionRequest()` returns `false` for a falsy body and for any non-array `messages`/`input`, and `hasImageParts()` returns `false` for non-array content and skips null/primitive parts. A body that arrives already parsed (not a string) is handled by the existing parse guard. Alternative (rejected): throwing on unexpected shapes — the interceptor must never be the reason a request fails.

## Risks / Trade-offs

- [False positives] → A body containing an image part for a non-vision model gets the header. Accepted: the header is a routing hint, and the payload would fail validation anyway. The cost of a false positive is nil; the cost of a false negative is a broken vision path.
- [Whole-body scan cost] → `Array.prototype.some` over messages and content parts on every request. Bounded by conversation length and negligible next to the JSON parse already performed on the same body.
- [Shape drift] → If GitHub adds a fourth part type for images, detection silently misses it. Mitigation: the type set is a single named constant at the top of the detection block, and the tests enumerate each shape by name, so a new shape is a one-line addition with an obvious test to pair it with.
- [Unvalidated against live API] → The header name and the 400 error string are corroborated by opencode's implementation and by independent reports of `missing required Copilot-Vision-Request header for vision requests` from other Copilot clients, but the acceptance test is a live `readImage` round-trip against a Copilot Anthropic model.
