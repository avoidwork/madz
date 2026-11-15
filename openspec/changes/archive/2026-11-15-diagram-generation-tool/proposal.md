# Proposal

## Why

For architecture work, generating a diagram from a spec is a natural capability that is absent. The agent can describe a system but cannot render it visually. The harness has prompt-based image generation (`generateImage`) but no way to render a structured diagram spec (mermaid/graphviz) to SVG/PNG.

## What Changes

- Add a new `diagram` tool (`src/tools/diagram/index.js`) supporting `mermaid` and `graphviz` input formats, rendering to `svg` or `png` output.
- Register the tool in `src/tools/index.js` (import, `TOOLS` map, `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, and a `case "diagram"` in `buildToolConfig()`).
- Enforce sandbox allowlist on output paths via `validatePath()` from `src/tools/common.js`.
- Add unit tests (`tests/unit/tools/diagram.test.js`) and an integration test (`tests/integration/tools/diagram.test.js`).
- Add dependencies: `@viz-js/viz` (graphviz), `mermaid` (mermaid), `jsdom` (DOM shim for mermaid), `sharp` (SVG→PNG).

## Capabilities

### New Capabilities
- `diagram-tool`: Rendering mermaid and graphviz diagram specs to SVG or PNG, with sandbox allowlist enforcement on output paths.

### Modified Capabilities
<!-- No existing capability changes; `generate-image` stays scoped to prompt-based image generation. -->

## Impact

- **Code**: `src/tools/diagram/index.js` (new), `src/tools/index.js` (registry wiring).
- **Tests**: `tests/unit/tools/diagram.test.js`, `tests/integration/tools/diagram.test.js` (new).
- **Dependencies**: `@viz-js/viz`, `mermaid`, `jsdom`, `sharp` added to `package.json`.
- **Security**: No arbitrary file writes; allowlist output paths; Zod input validation.

## Non-goals

- Not modifying `generate-image` / `image` — that stays scoped to prompt-based image generation.
- Not adding a hosted/browser-based renderer (no network dependency).
