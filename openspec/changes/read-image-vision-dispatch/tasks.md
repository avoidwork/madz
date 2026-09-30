## 1. sendImage Content Builder

- [x] 1.1 Create `src/tools/image/sendImage.js` with a Zod schema (`data` required, `mimeType` optional, `text` required)
- [x] 1.2 Implement the content-builder: validate MIME type against a known image MIME set (defaulting to `image/png`), reject missing/empty `data`, and construct `[{ type: "text", text }, { type: "image_url", image_url: { url: "data:<mimeType>;base64,<data>" } }]`
- [x] 1.3 Export `sendImage` (and its impl) from `src/tools/image/sendImage.js`

## 2. Image Dispatch Middleware

- [x] 2.1 Create `src/provider/imageDispatchMiddleware.js` with a `createImageDispatchMiddleware` factory using `createMiddleware({ name, wrapModelCall })`
- [x] 2.2 Implement `wrapModelCall`: scan `request.messages` for `readImage` ToolMessages, parse each tool result JSON, build a multimodal content array via `sendImage`'s content-building logic, and inject a HumanMessage into `request.messages` before invoking the handler
- [x] 2.3 Skip `ok: false` results, missing/empty `data`, and malformed JSON; default unknown MIME to `image/png`
- [x] 2.4 Support multiple `readImage` results in one turn (one HumanMessage with multiple image blocks)

## 3. Orchestrator Registration

- [x] 3.1 Import `createImageDispatchMiddleware` in `src/agent/deepAgents.js`
- [x] 3.2 Register the middleware in the `createDeepAgent` `middleware: [...]` array, after summarization and before token-budget

## 4. Tests

- [x] 4.1 Create `tests/unit/tools/image/sendImage.test.js` covering content construction, MIME defaulting, and missing/empty data rejection
- [x] 4.2 Create `tests/unit/provider/imageDispatchMiddleware.test.js` covering detection of a `readImage` ToolMessage, content-array construction, MIME defaulting, `ok: false` skip, multiple images, and no-op when no `readImage` messages
- [x] 4.3 Create `tests/integration/imageDispatch.test.js` simulating a user prompt that triggers `readImage` and asserting the next model request contains the image content block

## 5. Verification

- [x] 5.1 Run `npm run test` and confirm all tests pass
- [x] 5.2 Run `npm run lint` and confirm clean
- [x] 5.3 Run `npm run coverage` and confirm maintained
