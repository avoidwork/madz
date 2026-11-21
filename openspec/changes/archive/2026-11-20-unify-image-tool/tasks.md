# Tasks

## 1. Implement unified image tool

- [x] 1.1 Rewrite `src/tools/image/index.js` to export a single `image` tool (`imageImpl`) that dispatches on `input.action` (`read`, `resize`, `metadata`, `convert`, `generate`). Preserve the `generateWithFal` helper and the `generate` action logic (prompt validation, FAL API key resolution, FAL.ai POST, `{ ok, imageUrl?, error? }` return). Verify by reading the file and confirming the `image` tool is exported and dispatches on `action`.
- [x] 1.2 Fold the `read` action logic (from `src/tools/image/readImage.js`) into `src/tools/image/index.js`: `validatePath` against the sandbox allowlist, `stat` existence check, async `readFile`, `detectMimeType`, and `constrainDimensions` downscale to `config.image.maxDimension`, returning an `image_url` content block. Preserve the `MIME_TYPES` map, `DEFAULT_MIME_TYPE`, `detectMimeType`, and `constrainDimensions` helpers. Verify by reading the file.
- [x] 1.3 Add the `resize` action: resize an image to a target width/height (or max dimension) preserving aspect ratio (`fit: "inside"`, `withoutEnlargement: true`), writing the result to a target path. Validate the source path against the sandbox allowlist. Verify by reading the file.
- [x] 1.4 Add the `metadata` action: return image metadata (width, height, format, etc.) via `sharp(buffer).metadata()`, returning `{ ok: true, metadata }`. Validate the source path against the sandbox allowlist. Verify by reading the file.
- [x] 1.5 Add the `convert` action: convert an image to a target format (png/jpeg/webp/etc.) via sharp, writing the result to a target path. Validate the source path against the sandbox allowlist. Verify by reading the file.
- [x] 1.6 Define the `image` tool's Zod schema with a required `action` enum (`read`, `resize`, `metadata`, `convert`, `generate`) plus action-specific optional fields. Verify by reading the file.
- [x] 1.7 Delete `src/tools/image/readImage.js` (its logic is folded into the `image` tool). Verify the file is removed.

## 2. Update registration points

- [x] 2.1 In `src/tools/index.js`, update `TOOL_PERMISSIONS`: replace `generateImage: ["network:outbound"]` and `readImage: ["filesystem:read"]` with a single `image` entry. Verify by reading the file.
- [x] 2.2 In `src/tools/index.js`, update `TOOL_CLASSIFICATIONS`: replace the `generateImage`/`readImage` entries with a single `image` entry covering the union of agent types. Verify by reading the file.
- [x] 2.3 In `src/tools/index.js`, update `ORCHESTRATOR_TOOLS`: replace `readImage` with `image`. Verify by reading the file.
- [x] 2.4 In `src/tools/index.js`, update `TOOLS`: replace `generateImage`/`readImage` with `image`. Verify by reading the file.
- [x] 2.5 In `src/tools/index.js`, update the `buildToolConfig` switch: replace the `generateImage` case with an `image` case that gates on `hasAllPerms` and `runtimeOptions.falApiKey`. Verify by reading the file.
- [x] 2.6 In `src/agent/deepAgents.js`, update `hasVisionBlock` to detect the `image` tool's `read` result (the `image_url` content block) instead of `message.name === "readImage"`. Verify by reading the file.
- [x] 2.7 In `src/agent/evictionCeiling.js`, update comments referencing `readImage` to reference the `image` tool. Verify by reading the file.
- [x] 2.8 In `src/config/schemas/image.js`, update comments referencing `readImage` to reference the `image` tool. Verify by reading the file.

## 3. Update docs

- [x] 3.1 Update `docs/FEATURES.md`: replace `readImage`/`generateImage` references with `image` in the agent tool-access tables, tool descriptions, and permission tables. Verify by reading the file.
- [x] 3.2 Update `docs/FLOWS.md`: replace `readImage`/`generateImage` references with `image` in the tool registration flow, orchestrator tool list, and image tool entry. Verify by reading the file.
- [x] 3.3 Update `prompts/SYSTEM_PROMPT.md` section 2.11 to reference the `image` tool's `read` action. Verify by reading the file.

## 4. Update tests

- [x] 4.1 Create `tests/unit/tools/image/image.test.js` covering the `image` tool's `read`, `resize`, `metadata`, `convert`, and `generate` actions. Verify by running the test.
- [x] 4.2 Update `tests/unit/tools/image/readImage.test.js` and `tests/unit/tools/image/generateImage.test.js` to reference the `image` tool (or fold into `image.test.js`). Verify by running the tests.
- [x] 4.3 Update `tests/unit/tools/image/imageFlow.test.js` to reference the `image` tool's `read` action. Verify by running the test.
- [x] 4.4 Update `tests/unit/tools_image.test.js` to reference the `image` tool's `generate` action. Verify by running the test.
- [x] 4.5 Update `tests/unit/tool_index.test.js` to reference `image` instead of `generateImage`. Verify by running the test.
- [x] 4.6 Update `tests/unit/tools_orchestrator.test.js` to reference `image` instead of `readImage`. Verify by running the test.
- [x] 4.7 Update `tests/unit/tool_registration.test.js` to reference `image` instead of `generateImage`. Verify by running the test.
- [x] 4.8 Update `tests/unit/evictionCeiling.test.js`, `tests/unit/subagentEvictionMiddleware.test.js`, `tests/unit/deepAgents.test.js`, `tests/unit/deepAgentsEviction.test.js`, and `tests/integration/evictionCeiling.test.js` to reference the `image` tool. Verify by running the tests.

## 5. Verify

- [x] 5.1 Run `npm run test` and confirm all tests pass.
- [x] 5.2 Run `npm run lint` and confirm lint passes.
- [x] 5.3 Run `npm run coverage` and confirm coverage is maintained.
- [x] 5.4 Run `npm start` and confirm the application starts without crashing.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
