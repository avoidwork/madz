# Tasks

## 1. Schema and Path Validation

- [x] 1.1 Add `download` and `file` optional string fields to `ApiInputSchema` in `src/tools/api/index.js` and verify the schema accepts them (add a unit test asserting `download`/`file` are accepted and unknown fields are still rejected).
- [x] 1.2 Thread `allowedPaths` from `buildToolConfig` (`src/tools/index.js`) through `createApiTool(policy, runtime)` → `apiImpl(input, policy, runtime)` → `makeApiRequest(url, options)`, and verify the allowlist reaches the api tool (add a unit test asserting the api tool rejects a `download`/`file` path outside the sandbox).

## 2. Download Mode

- [x] 2.1 In `makeApiRequest`/`performRequest`, when `download` is set, validate the destination path via `validatePath()` and stream `resp.body` to the resolved path using `node:stream/promises` `pipeline` + `node:fs` `createWriteStream`, bypassing the `maxBodySize` cap for `download` only. Verify with a unit test that a download writes the body to disk and returns `{ ok: true, path, status }`.
- [x] 2.2 Ensure the download stream respects the AbortController timeout and redirect re-validation. Verify with a unit test that a stalled download times out and a download following a redirect to a blocked host is rejected.

## 3. Upload Mode

- [x] 3.1 In `encodeBody()`, add a multipart branch for `file`: validate the source path via `validatePath()`, read the file, and construct a `FormData` body appending the file as a `Blob`. Verify with a unit test that a `file` request sends a `multipart/form-data` body with a `Content-Type` boundary.
- [x] 3.2 Enforce mutual exclusivity among `body`, `form`, and `file`, and reject a body-carrying mode on a bodyless method. Verify with unit tests that `body`+`file` and `file` on `GET` are rejected.

## 4. Tests and Verification

- [x] 4.1 Add unit tests in `tests/unit/api.test.js` covering `download` and `file` schema validation and behavior, and verify `npm run test` passes.
- [x] 4.2 Add integration tests in `tests/integration/api.test.js` for download-to-disk and multipart upload, and verify `npm run test` passes.
- [x] 4.3 Run `npm run lint` and `npm run coverage` and verify both pass.
