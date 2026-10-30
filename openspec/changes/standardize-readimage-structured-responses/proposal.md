# Proposal

## Why

The `readImage` tool's `readImageImpl` returns inconsistent shapes: error branches return `JSON.stringify({ ok: false, ... })` (a string), while the success branch returns a raw array of `{ type: "image_url", image_url: { url } }` content blocks. This mixed behavior is confusing for consumers and inconsistent with the structured-object convention (`{ ok: true, ... }` / `{ ok: false, error: ... }`) used elsewhere in the codebase and documented in the `read-image` spec.

## What Changes

- `readImageImpl` now returns a native structured object on **success**: `{ ok: true, content: [{ type: "image_url", image_url: { url: dataUri } }] }`.
- `readImageImpl` now returns a native structured object on **failure**: `{ ok: false, error: <message> }` for all four error branches (missing path, path validation failure, file not found, read failure). The `JSON.stringify` wrapper is removed.
- The JSDoc `@returns` annotation is updated to reflect the new structured shape.
- Existing unit tests are updated to assert the new shape, and new tests cover each failure path.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `read-image`: The "Read image from disk" requirement's success scenario changes from returning `{ ok: true, mimeType, data }` to returning `{ ok: true, content: [...] }` where `content` is an array of image content blocks. The failure scenarios already specify `{ ok: false, error }` and are now actually satisfied by the implementation (previously returned as stringified JSON).

## Impact

- **Code**: `src/tools/image/readImage.js` — `readImageImpl` return shape and JSDoc.
- **Tests**: `tests/unit/tools/image/readImage.test.js` and `tests/unit/tools/image/imageFlow.test.js` — updated assertions.
- **Dependencies**: None. No new packages.
- **Consumers**: Callers that previously received a raw content-block array must now read `result.content`.

## Non-goals

- No changes to other tools.
- No changes to `readImage` tool metadata (name, description, zod schema) beyond what's required.
- No new packages or dependencies.
- No change to the downscaling, MIME detection, or path-validation logic.
