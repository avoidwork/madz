## 1. Config Schema

- [x] 1.1 Create `src/config/schemas/image.js` with `ImageSchema = z.object({ maxSize: z.string().default("100kb") })`
- [x] 1.2 Wire `ImageSchema` into `ConfigSchema` in `src/config/config.js`
- [x] 1.3 Export `ImageSchema` from `src/config/schemas/index.js`
- [x] 1.4 Add `image:\n  maxSize: 100kb` to `config.yaml`

## 2. Tool Implementation

- [x] 2.1 Create `src/tools/image/readImage.js` with a Zod schema (`path` required, `maxSize` optional)
- [x] 2.2 Implement the impl function: validate path via `validatePath`, check size via `checkFileLimit`/`parseSizeString`, read file via `node:fs/promises`, detect MIME type, return `{ ok, mimeType, data }`
- [x] 2.3 Export the `readImage` tool via `tool()` from `@langchain/core/tools`

## 3. Tool Registration

- [x] 3.1 Import `readImage` in `src/tools/index.js`
- [x] 3.2 Add `readImage` to `TOOL_PERMISSIONS` with `["filesystem:read"]`
- [x] 3.3 Add `readImage` to `TOOL_CLASSIFICATIONS`
- [x] 3.4 Add `readImage` to `TOOLS`

## 4. Tests

- [x] 4.1 Create `tests/unit/tools/image/readImage.test.js`
- [x] 4.2 Cover schema validation (missing path, invalid types)
- [x] 4.3 Cover size-limit rejection
- [x] 4.4 Cover MIME type detection
- [x] 4.5 Cover base64 output for a valid image

## 5. Verification

- [x] 5.1 Run `npm run test` and confirm all tests pass
- [x] 5.2 Run `npm run lint` and confirm clean
- [x] 5.3 Run `npm run coverage` and confirm maintained
