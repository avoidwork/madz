# Design

## Context

See proposal.md - Why. The `readImageImpl` function in `src/tools/image/readImage.js` currently returns a raw content-block array on success and `JSON.stringify`-wrapped error strings on failure. The `read-image` spec already documents the intended `{ ok: true, ... }` / `{ ok: false, error }` shape, but the implementation does not match it.

## Goals / Non-Goals

**Goals:**
- Make `readImageImpl` return a native structured object on both success and failure.
- Remove all `JSON.stringify`-wrapped error returns.
- Update the JSDoc `@returns` annotation.
- Update existing tests and add failure-path coverage.

**Non-Goals:**
- No change to the downscaling, MIME detection, or path-validation logic.
- No change to the tool's zod schema, name, or description.
- No new dependencies.

## Decisions

- **Success shape:** `{ ok: true, content: [{ type: "image_url", image_url: { url: dataUri } }] }`. The existing content-block array is preserved as the `content` field so LangChain still receives the image block intact. Alternative considered: returning `{ ok: true, ...contentBlock }` — rejected because it loses the array structure and complicates consumers.
- **Failure shape:** `{ ok: false, error: <message> }` as a native object. The `JSON.stringify` wrapper is removed. Alternative considered: keeping the stringified form — rejected because it forces consumers to parse strings and is inconsistent with the spec.
- **JSDoc:** Update `@returns` to `Promise<{ ok: boolean, content?: Array, error?: string }>`.

## Risks / Trade-offs

- [Consumers relying on the raw array] → They must now read `result.content`. The `readImage` tool is the only consumer; the change is contained to `readImageImpl` and its tests.
- [Test breakage] → Existing tests assert `Array.isArray(result)` and `result[0].image_url.url`; these are updated to `result.ok === true` and `result.content[0].image_url.url`.
