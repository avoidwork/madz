# Design

## Context

See proposal.md - Why. The harness exposes two image tools: `readImage` (`src/tools/image/readImage.js`) and `generateImage` (`src/tools/image/index.js`). Both are registered in `src/tools/index.js` across `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `ORCHESTRATOR_TOOLS`, `TOOLS`, and the `buildToolConfig` switch. The `readImage` result is an `image_url` content block detected by `hasVisionBlock` in `src/agent/deepAgents.js` via `message.name === "readImage"`. `sharp` is already a dependency.

## Goals / Non-Goals

- **Goals:** Unify image tooling into a single `image` tool dispatching on an `action` enum; preserve `readImage` and `generateImage` behavior exactly; update all registration points, middleware detection, docs, specs, and tests.
- **Non-Goals:** No change to the FAL.ai API call or `generateWithFal` logic; no new dependencies; no change to other tools; archived openspec specs are not modified.

## Decisions

### Decision 1: Single `image` tool with action dispatch
A single `image` tool (`imageImpl`) dispatches on `input.action` to per-action handlers. This matches the harness's multi-action tool pattern (e.g., `file`, `process`, `email`). The alternative — keeping two tools — is rejected because the issue requires exactly one image tool.

### Decision 2: `read` action folds in `readImageImpl`
The `read` action reuses the existing `readImageImpl` logic: `validatePath` against the sandbox allowlist, `stat` existence check, async `readFile`, `detectMimeType`, and `constrainDimensions` downscale to `config.image.maxDimension`. It returns `[{ type: "image_url", image_url: { url: "data:<mime>;base64,..." } }]`. The `MIME_TYPES` map, `DEFAULT_MIME_TYPE`, `detectMimeType`, and `constrainDimensions` helpers are preserved in the unified module.

### Decision 3: `generate` action folds in `generateImageImpl`/`generateWithFal`
The `generate` action reuses the existing `generateImageImpl`/`generateWithFal` logic: validate prompt (non-empty, ≤1000 chars), read FAL API key from `options.falApiKey` or `config.providers.fal.credentials.apiKey`, POST to `https://queue.fal.run/fal-ai/flux/klein` with `sync_mode: true` and `image_size: "square_1_1"`, return `{ ok: true, imageUrl }` or `{ ok: false, error }`. Uses an `AbortController` timeout (default 30000ms).

### Decision 4: `resize`, `metadata`, `convert` actions use sharp
- `resize`: resize to target width/height or max dimension, `fit: "inside"`, `withoutEnlargement: true`, write to target path.
- `metadata`: `sharp(buffer).metadata()`, return `{ ok: true, metadata }`.
- `convert`: convert to target format (png/jpeg/webp/etc.), write to target path.
All validate the source path against the sandbox allowlist and handle non-image inputs gracefully.

### Decision 5: Permission model
`TOOL_PERMISSIONS` replaces `generateImage: ["network:outbound"]` and `readImage: ["filesystem:read"]` with a single `image` entry. The `image` tool requires `filesystem:read` (for read/resize/metadata/convert) and `network:outbound` (for generate). The `buildToolConfig` switch's `image` case gates on `hasAllPerms` and `runtimeOptions.falApiKey` (the `generate` action needs the FAL key). The `read`/`resize`/`metadata`/`convert` actions need only `filesystem:read`.

### Decision 6: `hasVisionBlock` detection
`hasVisionBlock` in `src/agent/deepAgents.js` currently detects `message.name === "readImage"`. Since the `image` tool's `read` action returns an `image_url` content block, the detection is updated to detect the `image` tool's `read` result. The `image_url` content block detection (the second branch) already covers the vision case; the `readImage`-specific branch is updated to reference the `image` tool.

## Risks / Trade-offs

- **[Permission union may over-gate the `read` action]** → The `image` tool requires both `filesystem:read` and `network:outbound`. If a deployment grants only `filesystem:read`, the `image` tool won't register, losing the `read` action. Mitigation: the `image` tool registers when `hasAllPerms` (both perms) is true; the `generate` action additionally requires the FAL key. This matches the issue's requirement that `generate` requires `network:outbound`.
- **[Vision-block detection drift]** → `hasVisionBlock` must detect the `image` tool's `read` result. Mitigation: the `image_url` content block branch already covers the vision case; the `readImage`-specific branch is updated to reference the `image` tool.
- **[Test churn]** → Many tests reference `readImage`/`generateImage`. Mitigation: update tests to reference the `image` tool and add coverage for the new `resize`/`metadata`/`convert` actions.

## Migration Plan

1. Implement the unified `image` tool in `src/tools/image/index.js`.
2. Update `src/tools/index.js` registration points.
3. Update `src/agent/deepAgents.js` vision-block detection.
4. Update `src/agent/evictionCeiling.js` and `src/config/schemas/image.js` comments.
5. Update docs (`docs/FEATURES.md`, `docs/FLOWS.md`, `prompts/SYSTEM_PROMPT.md`).
6. Update tests.
7. Verify `npm run test`, `npm run lint`, `npm run coverage`, and `npm start`.

## Open Questions

None.
