## 1. Vision Detection

- [x] 1.1 Add `VISION_PART_TYPES` frozen set (`image_url`, `input_image`, `image`) to `src/provider/copilotAuth.js`
- [x] 1.2 Add `hasImageParts(content)` — returns true for any image part, recursing into `tool_result` blocks
- [x] 1.3 Add `isVisionRequest(body)` — scans every item of `body.messages` or `body.input`; returns false for a falsy body or non-array items

## 2. Header Injection

- [x] 2.1 In `createCopilotFetch()`, set `Copilot-Vision-Request: true` when `isVisionRequest(body)` is true
- [x] 2.2 Leave `x-initiator`, `Openai-Intent`, `X-GitHub-Api-Version`, and `User-Agent` behavior unchanged

## 3. Tests

- [x] 3.1 Add `Copilot-Vision-Request header` suite to `tests/unit/provider/copilotAuth.test.js`
- [x] 3.2 Cover Completions `image_url`, Responses `input_image`, and Anthropic `image` part types
- [x] 3.3 Cover an image nested inside an Anthropic `tool_result`
- [x] 3.4 Cover an image outside the final message (whole-body scan)
- [x] 3.5 Cover negatives: text-only, non-image content arrays, non-JSON body
- [x] 3.6 Cover a pre-parsed (non-string) body and malformed content entries (null, bare string, missing content)

## 4. Verification

- [x] 4.1 `npm run lint` passes
- [x] 4.2 `npm test` passes (4228 tests)
- [x] 4.3 `npm run coverage` maintains line coverage (`copilotAuth.js` 99.43%)
- [ ] 4.4 Live round-trip: `readImage` on a screenshot against a Copilot Anthropic model returns a description of the image
