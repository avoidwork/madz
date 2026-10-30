# Proposal

## Why

The `generateImage` tool currently returns a `JSON.stringify({...})` string from `generateImageImpl`. This forces every caller to `JSON.parse` the response before it can be used, is inconsistent with tools that return native objects, and makes error handling fragile — a stringified error cannot be inspected as a structured object. The helper `generateWithFal` already returns native `{ ok, imageUrl?, error? }` objects; only the impl stringifies them.

## What Changes

- `generateImageImpl` in `src/tools/image/index.js` returns native structured objects on both success and failure instead of `JSON.stringify`-wrapped strings.
- On success, return `{ ok: true, imageUrl }`; on failure, return `{ ok: false, error }`.
- Update the JSDoc `@returns` on `generateImageImpl` and the `generateImage` tool wrapper to document the structured shape.
- Add/update unit tests in `tests/unit/tools/image/` to assert the object shape on success and each error path.

## Capabilities

### New Capabilities
- `generate-image`: the `generateImage` tool that generates an image from a text prompt via FAL.ai and returns a structured `{ ok, imageUrl?, error? }` result.

### Modified Capabilities
<!-- No existing capability's requirements change; this is a new capability. -->

## Impact

- `src/tools/image/index.js` — `generateImageImpl` return values and JSDoc.
- `tests/unit/tools/image/` — new/updated tests asserting the structured object shape.

## Non-goals

- No change to the `generateImage` tool's Zod schema or its registration in `src/tools/index.js`.
- No change to `generateWithFal`'s logic or the FAL.ai API call.
- No change to other tools.
