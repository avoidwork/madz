## 1. Dependency

- [x] 1.1 Add `puppeteer-core` to `package.json` dependencies and run `npm install` so it lands in `package-lock.json`

## 2. Browser Helper

- [x] 2.1 Create `src/tools/web/browser.js` — a shared browser-launch helper that resolves the system Chromium path (`/usr/bin/chromium`), launches with `--no-sandbox --disable-dev-shm-usage`, and applies a per-call timeout

## 3. renderWeb Tool

- [x] 3.1 Implement `renderWeb` in `src/tools/web/index.js` (or a sibling module) — validate the URL with `filterUrl`, launch Chromium, wait for load, extract JS-aware text, return it. Zod schema: `{ url: z.string().url(), timeout?: z.number() }`

## 4. screenshotWeb Tool

- [x] 4.1 Implement `screenshotWeb` in `src/tools/web/index.js` (or a sibling module) — validate the URL, launch Chromium, capture a full-page screenshot, return `{ ok, mimeType: "image/png", data: <base64> }`. Zod schema: `{ url: z.string().url(), timeout?: z.number() }`

## 5. Registration

- [x] 5.1 In `src/tools/index.js`, import both tools and add them to `TOOLS`, `TOOL_PERMISSIONS` (`network:outbound`), `TOOL_CLASSIFICATIONS` (`["search", "research", "coding"]`), and `ORCHESTRATOR_TOOLS`

## 6. Tests

- [x] 6.1 Add `tests/unit/tools/web.test.js` coverage for `renderWeb` and `screenshotWeb` — schema validation, invalid URL rejection, and timeout handling

## 7. Verification

- [x] 7.1 Run `npm run test`, `npm run lint`, and `npm run coverage`; confirm Chromium actually launches in the container (probe it, don't assume) before trusting the implementation
