# Design

## Context

The `api` tool (`src/tools/api/index.js`) is a REST client with URL filtering, SSRF checks, per-host rate limiting, manual redirect re-validation, streamed size limits, and retries. It currently buffers response bodies in-memory (base64 for non-text) capped at `maxBodySize`, and supports only JSON (`body`) and urlencoded (`form`) request bodies. See `proposal.md - Why` for motivation.

The tool's input schema `ApiInputSchema` is `.strict()`, so new fields must be added or they are rejected. The tool is registered in `src/tools/index.js` via `createApiTool(config?.api)`; the sandbox path allowlist is available as `runtimeOptions.allowedPaths` in `buildToolConfig`.

## Goals / Non-Goals

**Goals:**
- Add a `download` mode that streams a response body to disk, bypassing the `maxBodySize` cap for `download` only.
- Add a `file` mode that sends a local file as `multipart/form-data`.
- Both modes respect the existing `timeout`, `allowlist`, `rateLimit`, `maxRedirects`, `maxRetries`, and `credential` handling.
- Preserve the existing `api` export shape (`export const api = ...` via `createApiTool()`).

**Non-Goals:**
- No new tool name or `create*Tool()` factory.
- No change to `src/sandbox/urlFilter.js`.
- No change to `ApiSchema` (config) — `maxBodySize` is bypassed only for `download`, not removed.

## Decisions

### Decision 1: Thread `allowedPaths` into the api tool
The sandbox path allowlist is available as `runtimeOptions.allowedPaths` in `buildToolConfig` (`src/tools/index.js`), but `createApiTool` is currently called with only `config?.api`. To validate `download`/`file` paths, thread `runtimeOptions.allowedPaths` through `createApiTool(policy, runtime)` → `apiImpl(input, policy, runtime)` → `makeApiRequest(url, options)`.

- **Alternative considered:** Import `config.sandbox.paths` directly in `api/index.js` (as `file`/`tts` do). Rejected: the `api` tool is constructed with a `policy` argument and should not reach into global config; threading the allowlist keeps it testable and consistent with the tool's DI pattern.

### Decision 2: Stream downloads via `node:stream/promises` `pipeline`
In `performRequest`, at the final hop (after the manual redirect loop and per-hop `filterUrl` re-validation), when `download` is set, stream `resp.body` to the resolved path via `pipeline(resp.body, createWriteStream(path))` instead of calling `buildResult()`. This bypasses the `maxBodySize` cap (which only applies to the in-memory buffering path in `buildResult`/`readBody`).

- **Alternative considered:** Buffer the body then `writeFile`. Rejected: defeats the purpose of streaming large downloads and still hits the `maxBodySize` cap.

### Decision 3: Keep the AbortController timeout active across the stream
The `AbortController` timeout in `performRequest` already covers redirects and the full body read. For `download`, the fetch `signal` is passed to the stream so a stalled body is aborted; the timeout is cleared in `finally`.

### Decision 4: Build multipart bodies with the global `FormData`/`Blob`
In `encodeBody()`, when `file` is set, validate the source path, read the file with `node:fs/promises` `readFile`, and construct a `FormData` body appending the file as a `Blob`. `fetch` auto-sets the `Content-Type: multipart/form-data; boundary=...` header for `FormData` bodies, so no manual boundary is needed.

- **Alternative considered:** Manually constructing the multipart boundary and body. Rejected: error-prone and duplicates what `FormData`/`fetch` already handle.

### Decision 5: Make `encodeBody` async and return `{ body, error }`
`encodeBody` becomes async and returns `{ body, error }` so path-validation failures (e.g., file not found, outside sandbox) propagate cleanly to the caller.

## Risks / Trade-offs

- [Streaming a download to a path outside the sandbox] → Validate the destination with `validatePath()` before writing; fail closed when no allowlist is configured.
- [A stalled download body outliving the timeout] → Wire the fetch `signal` to the stream so the abort propagates; clear the timeout in `finally`.
- [Multipart body size] → No explicit cap on upload size; the file is read into memory as a `Blob`. Acceptable for the tool's use case; a streaming upload is out of scope.
- [Mutual exclusivity] → Enforce that only one of `body`, `form`, or `file` is provided, and that a body-carrying mode is not used on a bodyless method.
