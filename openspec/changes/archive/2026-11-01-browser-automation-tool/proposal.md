## Why

madz's web toolset is read-only: `searchWeb`, `extractWeb`, `renderWeb`, and `screenshotWeb` all produce snapshots. There is no way to click a button, fill a form, log in, or extract data from anything behind a login or an interactive SPA. A companion agent that can research but not act on a web page is half a tool.

## What Changes

- Add a new `browser` tool that drives a real headless Chromium browser via `puppeteer-core`.
- Support actions: `navigate`, `click`, `type`/`fill`, `press`, `screenshot`, `extract` (DOM text), `waitFor` (selector/network idle), and `evaluate` (run JS in page context).
- Validate every outbound URL against `filterUrl` (SSRF protection).
- Return page text, a base64 screenshot (for `readImage`), or a JSON error string.
- Register the tool in `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `TOOLS`, and the `buildToolConfig` switch in `src/tools/index.js`.
- Reuse the `launchBrowser`/`openPage` helpers in `src/tools/browser/browser.js`.

## Capabilities

### New Capabilities
- `browser-automation`: Driving a headless browser — navigate, click, type/fill, press, screenshot, extract DOM text, wait for selectors/network-idle, and evaluate JS in page context, with URL validation against the sandbox allowlist.

### Modified Capabilities
- `render-web`: No requirement changes — the new tool is additive; `renderWeb` behavior is unchanged.
- `screenshot-web`: No requirement changes — the new tool is additive; `screenshotWeb` behavior is unchanged.

## Impact

- **New file**: `src/tools/browser/index.js` — the `browser` tool implementation.
- **Modified**: `src/tools/index.js` — `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `TOOLS`, and `buildToolConfig` switch.
- **Dependencies**: `puppeteer-core` (already a dependency), system Chromium at `/usr/bin/chromium`.
- **Tests**: `tests/unit/tools/browser.test.js` (Zod schema validation) and `tests/integration/tools/browser.test.js` (navigate/click/fill/extract against a local fixture page).

## Non-goals

- No persistent browser session across calls — the session is per-call and ephemeral.
- No credential storage — the browser session is ephemeral.
- No arbitrary code execution outside the sandboxed page context.
- No bundling of a full Puppeteer download — uses `puppeteer-core` against system Chromium.
