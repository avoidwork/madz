# Proposal

## Why

The harness exposes two separate image tools — `readImage` (reads an image from disk and returns a base64 data-URI `image_url` content block for LLM vision analysis) and `generateImage` (generates an image from a text prompt via FAL.ai FLUX Klein). This fragmentation forces the orchestrator to choose between two tools and duplicates registration, permission, classification, and documentation. Unifying them into a single `image` tool that dispatches on an `action` enum simplifies the tool surface and centralizes image behavior.

## What Changes

- **BREAKING**: Retire `readImage` and `generateImage` as standalone tools. Replace them with a single `image` tool that dispatches on a required `action` enum (`read`, `resize`, `metadata`, `convert`, `generate`).
- The `read` action preserves the existing `readImage` behavior: validate the path against the sandbox allowlist, read via async `node:fs/promises`, downscale to `config.image.maxDimension` preserving aspect ratio, and return an `image_url` content block.
- The `generate` action preserves the existing `generateImage` behavior: validate the prompt (non-empty, ≤1000 chars), POST to FAL.ai FLUX Klein, and return `{ ok: true, imageUrl }` or `{ ok: false, error }`.
- The `resize` action resizes an image to a target width/height (or max dimension) preserving aspect ratio; the `metadata` action returns image metadata via sharp; the `convert` action converts an image to another format (png/jpeg/webp/etc.).
- Update all registration points (`src/tools/index.js`), the deepAgents vision-block detection (`src/agent/deepAgents.js`), the eviction ceiling comments (`src/agent/evictionCeiling.js`), config schema comments (`src/config/schemas/image.js`), docs, openspec specs, and tests.

## Capabilities

### New Capabilities
- `image-tool`: the unified `image` tool that dispatches on an `action` enum (`read`, `resize`, `metadata`, `convert`, `generate`), covering reading an image from disk for vision analysis, resizing, metadata extraction, format conversion, and FAL.ai generation.

### Modified Capabilities
- `read-image`: the `readImage` tool's requirements change as its behavior folds into the `image` tool's `read` action.
- `generate-image`: the `generateImage` tool's requirements change as its behavior folds into the `image` tool's `generate` action.

## Impact

- `src/tools/image/index.js` — new unified `image` tool with `imageImpl` dispatching on `action`; folds in `generateWithFal`/`generateImageImpl` logic.
- `src/tools/image/readImage.js` — retired; its `readImageImpl`/`constrainDimensions`/`detectMimeType` logic folds into the `image` tool's `read` action.
- `src/tools/index.js` — `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `ORCHESTRATOR_TOOLS`, `TOOLS`, and the `buildToolConfig` switch.
- `src/agent/deepAgents.js` — `hasVisionBlock` detection of the `image` tool's `read` result.
- `src/agent/evictionCeiling.js`, `src/config/schemas/image.js` — comment updates.
- `docs/FEATURES.md`, `docs/FLOWS.md`, `prompts/SYSTEM_PROMPT.md` — documentation updates.
- `tests/unit/tools/image/`, `tests/unit/tools_image.test.js`, `tests/unit/tool_index.test.js`, `tests/unit/tools_orchestrator.test.js`, `tests/unit/tool_registration.test.js`, `tests/unit/evictionCeiling.test.js`, `tests/unit/subagentEvictionMiddleware.test.js`, `tests/unit/deepAgents.test.js`, `tests/unit/deepAgentsEviction.test.js`, `tests/integration/evictionCeiling.test.js` — test updates.

## Non-goals

- No change to the FAL.ai API call or the `generateWithFal` logic.
- No change to other tools.
- Archived openspec specs (in `openspec/changes/archive/`) are historical and not modified.
- No new dependencies — `sharp` is already a dependency.
