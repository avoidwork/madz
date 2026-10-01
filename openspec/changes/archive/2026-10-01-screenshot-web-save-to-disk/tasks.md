## 1. Configuration

- [x] 1.1 Add `screenshotsDir: memory/screenshots/` to the `memory:` section of `config.yaml`
- [x] 1.2 Add `screenshotsDir: z.string().default("memory/screenshots/")` to `MemorySchema` in `src/config/schemas/memory.js`

## 2. Helper

- [x] 2.1 Create `ensureScreenshotsDir(screenshotsDir, cwdParam = cwd)` in `src/memory/screenshots.js` mirroring `ensureSessionsDir` in `src/session/factory.js`
- [x] 2.2 Export `ensureScreenshotsDir` from `src/memory/index.js`

## 3. Tool Implementation

- [x] 3.1 Modify `screenshotWebImpl` in `src/tools/web/index.js` to write the captured PNG to `join(cwd, config.memory.screenshotsDir, <filename>)` using `writeFile`, then return `{ ok: true, mimeType: "image/png", path }`
- [x] 3.2 Update the `screenshotWeb` tool description and schema to reflect it saves to disk and returns a path

## 4. Tests

- [x] 4.1 Update `tests/unit/tools/web.test.js` `screenshotWebImpl` tests to assert the new file-path/MIME return shape
- [x] 4.2 Add a test for `ensureScreenshotsDir`

## 5. Verification

- [x] 5.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm everything passes
