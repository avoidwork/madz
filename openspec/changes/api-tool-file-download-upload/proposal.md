# Proposal

## Why

The `api` tool is a robust REST client (URL filtering, SSRF checks, per-host rate limiting, redirect re-validation, streamed size limits, retries), but it has two gaps for file transfer: it returns response bodies in-memory (base64 for non-text) capped at `maxBodySize`, with no way to stream a large download to disk; and it supports only JSON (`body`) and urlencoded (`form`) request bodies, with no multipart/form-data support for sending a local file. These are the two cases a dedicated `transfer` tool would have covered, but they belong on `api` — it already owns the HTTP transport, validation, and security layer. Adding modes is a smaller, cleaner change than a new tool.

## What Changes

- Add a `download` field (string path) to the `api` tool input schema. When set, the response body is streamed to disk via `validatePath()` instead of buffered in-memory, bypassing the `maxBodySize` cap for `download` only.
- Add a `file` field (string path) to the `api` tool input schema. When set, the local file is sent as `multipart/form-data`, with the source path validated via `validatePath()`.
- Both modes respect the existing `timeout`, `allowlist`, `rateLimit`, `maxRedirects`, `maxRetries`, and `credential` handling already in `makeApiRequest()`.
- `encodeBody()` gains a multipart branch for `file`; `makeApiRequest()`/`performRequest()` gain a download-streaming path.
- The `api` tool's existing export shape (`export const api = ...` via `createApiTool()`) is preserved — no new tool name or `create*Tool()` factory.

## Capabilities

### New Capabilities
- `api-tool`: Defines the behavior of the `api` REST client tool, including its input schema, URL filtering, redirect re-validation, rate limiting, retries, credential handling, and the new `download` (stream-to-disk) and `file` (multipart upload) modes.

### Modified Capabilities
<!-- No existing capability's requirements change; the api tool has no prior spec. -->

## Impact

- `src/tools/api/index.js` — add `download`/`file` fields to `ApiInputSchema`; add a multipart branch to `encodeBody()`; add a download-streaming path to `makeApiRequest()`/`performRequest()`; thread `allowedPaths` through `createApiTool()` → `apiImpl()`.
- `src/tools/index.js` — pass `runtimeOptions.allowedPaths` to `createApiTool()`.
- `tests/unit/api.test.js` — add schema-validation and download/upload unit tests.
- `tests/integration/api.test.js` — add download-to-disk and multipart upload integration tests.
- No change to `src/sandbox/urlFilter.js` (outbound URL validation is unchanged).
- No change to `ApiSchema` (config) — `maxBodySize` is bypassed only for `download`, not removed.

## Non-goals

- No new tool name or `create*Tool()` factory.
- No change to `src/sandbox/urlFilter.js`.
- No change to `ApiSchema` (config) — `maxBodySize` cap is bypassed only for `download`, not removed.
- No change to the `api` tool's existing export shape.
