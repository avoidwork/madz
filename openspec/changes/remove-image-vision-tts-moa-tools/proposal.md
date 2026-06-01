## Why

The codebase includes four tools (`image_generate`, `vision_analyze`, `text_to_speech`, `mixture_of_agents`) that add external API dependencies (FAL_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY), increase attack surface through additional HTTP clients, image fetchers, and streaming audio handling, but are not part of the core agent workflow. Removing them simplifies the codebase, eliminates unnecessary API key requirements, and reduces maintenance burden.

## What Changes

- Delete `src/tools/image.js` — image generation tool using FAL API
- Delete `src/tools/vision.js` — vision analysis tool using OpenAI multimodal models
- Delete `src/tools/tts.js` — text-to-speech tool using OpenAI TTS API
- Delete `src/tools/moa.js` — mixture-of-agents tool using OpenRouter API
- Delete corresponding test files: `tests/unit/tools_image.test.js`, `tests/unit/tools_vision.test.js`, `tests/unit/tools_tts.test.js`, `tests/unit/tools_moa.test.js`
- Clean up `src/tools/index.js`: remove 4 imports, 4 TOOL_PERMISSIONS entries, 4 TOOL_FACTORIES entries, and their switch cases
- Update `openspec/specs/tools-tier2/spec.md`: remove all requirements for the 4 removed tools and the "Tier 2 Tools Require network:outbound Permission" requirement
- Update `docs/FLOWS.md`: remove tool reference entries for removed tools

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `tools-tier2`: Remove requirements for `vision_analyze`, `image_generate`, `text_to_speech`, `mixture_of_agents`, and the general "Tier 2 Tools Require network:outbound Permission" requirement

## Impact

- **Code files**: 4 tool files deleted, 1 module file modified (`src/tools/index.js`), 1 spec file modified (`tools-tier2/spec.md`)
- **Test files**: 4 test files deleted, `tool_index.test.js` may need updates
- **Docs**: `docs/FLOWS.md` updated
- **API keys**: Removes requirements for FAL_API_KEY, OPENAI_API_KEY (used only for removed tools), OPENROUTER_API_KEY
- **Permissions**: The `network:outbound` permission check is simplified since tier-2 references to removed tools disappear
