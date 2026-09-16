## 1. Config Schema

- [ ] 1.1 Create `src/config/schemas/image.js` with `ImageSchema = z.object({ maxSize: z.string().default("100kb") })`
- [ ] 1.2 Wire `ImageSchema` into `ConfigSchema` in `src/config/config.js`
- [ ] 1.3 Export `ImageSchema` from `src/config/schemas/index.js`
- [ ] 1.4 Add `image:\n  maxSize: 100kb` to `config.yaml`

## 2. Tool Implementation

- [ ] 2.1 Create `src/tools/image/readImage.js` with a Zod schema (`path` required, `maxSize` optional)
- [ ] 2.2 Implement the impl function: validate path via `validatePath`, check size via `checkFileLimit`/`parseSizeString`, read file via `node:fs/promises`, detect MIME type, return `{ ok, mimeType, data }`
- [ ] 2.3 Export the `readImage` tool via `tool()` from `@langchain/core/tools`

## 3. Tool Registration

- [ ] 3.1 Import `readImage` in `src/tools/index.js`
- [ ] 3.2 Add `readImage` to `TOOL_PERMISSIONS` with `["filesystem:read"]`
- [ ] 3.3 Add `readImage` to `TOOL_CLASSIFICATIONS`
- [ ] 3.4 Add `readImage` to `TOOLS`

## 4. Tests

- [ ] 4.1 Create `tests/unit/tools/image/readImage.test.js`
- [ ] 4.2 Cover schema validation (missing path, invalid types)
- [ ] 4.3 Cover size-limit rejection
- [ ] 4.4 Cover MIME type detection
- [ ] 4.5 Cover base64 output for a valid image

## 5. Verification

- [ ] 5.1 Run `npm run test` and confirm all tests pass
- [ ] 5.2 Run `npm run lint` and confirm clean
- [ ] 5.3 Run `npm run coverage` and confirm maintained
