## 1. Delete Tool Source Files

- [x] 1.1 Delete `src/tools/image.js` (image_generate tool, FAL API)
- [x] 1.2 Delete `src/tools/vision.js` (vision_analyze tool, OpenAI multimodal)
- [x] 1.3 Delete `src/tools/tts.js` (text_to_speech tool, OpenAI TTS)
- [x] 1.4 Delete `src/tools/moa.js` (mixture_of_agents tool, OpenRouter)
- [x] 2.1 Delete `tests/unit/tools_image.test.js`
- [x] 2.2 Delete `tests/unit/tools_vision.test.js`
- [x] 2.3 Delete `tests/unit/tools_tts.test.js`
- [x] 2.4 Delete `tests/unit/tools_moa.test.js`

## 3. Clean Up src/tools/index.js

- [x] 3.1 Remove import for `createImageTool` from `./image.js` (line 15)
- [x] 3.2 Remove import for `createVisionTool` from `./vision.js` (line 14)
- [x] 3.3 Remove import for `createTtsTool` from `./tts.js` (line 18)
- [x] 3.4 Remove import for `createMoaTool` from `./moa.js` (line 19)
- [x] 3.5 Remove `vision_analyze: []` entry from `TOOL_PERMISSIONS` (line 42)
- [x] 3.6 Remove `image_generate: ["network:outbound"]` entry from `TOOL_PERMISSIONS` (line 43)
- [x] 3.7 Remove `text_to_speech: []` entry from `TOOL_PERMISSIONS` (line 46)
- [x] 3.8 Remove `mixture_of_agents: []` entry from `TOOL_PERMISSIONS` (line 47)
- [x] 3.9 Remove `vision_analyze: createVisionTool` entry from `TOOL_FACTORIES` (line 66)
- [x] 3.10 Remove `image_generate: createImageTool` entry from `TOOL_FACTORIES` (line 67)
- [x] 3.11 Remove `text_to_speech: createTtsTool` entry from `TOOL_FACTORIES` (line 70)
- [x] 3.12 Remove `mixture_of_agents: createMoaTool` entry from `TOOL_FACTORIES` (line 71)
- [x] 3.13 Remove `case "vision_analyze":` switch block (lines 150-154)
- [x] 3.14 Remove `case "image_generate":` switch block (lines 156-160)
- [x] 3.15 Remove `text_to_speech` and `mixture_of_agents` from the combined switch case block (lines 163-170)

## 4. Update Spec Delta

- [x] 4.1 Verify delta spec at `openspec/changes/remove-image-vision-tts-moa-tools/specs/tools-tier2/spec.md` has correct REMOVED Requirements for vision_analyze, text_to_speech, and tier-2 permission blocks
- [x] 5.1 Remove vision_analyze, image_generate, text_to_speech, mixture_of_agents from the tool permission matrix (lines ~209-213)
- [x] 5.2 Remove vision_analyze, image_generate, text_to_speech, mixture_of_agents from the tier-2 tool reference list (lines ~362-366)
- [x] 5.3 Update the tool directory listing reference (line ~693) to remove vision, image, tts, moa

## 6. Update and Run Tests

- [x] 6.1 Update `tests/unit/tool_index.test.js`: remove OPENAI_API_KEY/FAL_API_KEY/OPENROUTER_API_KEY from beforeEach/afterEach hooks (lines 53-71)
- [x] 6.2 Update comment on line 124 that references removed tools
- [x] 6.2.1 Delete `tests/unit/tool_registration.test.js` (references removed tools: vision_analyze, image_generate, text_to_speech, mixture_of_agents)
- [x] 6.3 Run `npm run test` to verify all remaining tests pass
- [x] 6.4 Run `npm run coverage` to verify 100% coverage is maintained
