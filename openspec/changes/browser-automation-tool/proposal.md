## Why

madz's web toolset is read-only: `searchWeb`, `extractWeb`, `renderWeb`, and `screenshotWeb` all produce snapshots. There is no way to click a button, fill a form, log in, or extract data from anything behind a login or an interactive SPA. A companion agent that can research but not act on a web page is half a tool. This change adds a `browser` tool that drives a real headless browser, closing the gap between reading the web and acting on it.

## What Changes

- Add a `browser` tool (`src/tools/browser/index.js`) that drives a headless Chromium via Puppeteer.
- Expose an `action` discriminator supporting: `navigate`, `click`, `type`/`fill`, `press`, `screenshot`, `extract`, `waitFor`, and `evaluate`.
- Validate all outbound URLs against `filterUrl` (SSRF protection) before navigation.
- Reuse the existing `launchBrowser`/`openPage` helpers from `src/tools/web/browser.js`.
- Register the tool in `src/tools/index.js` (`TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `TOOLS`, and the `buildToolConfig` switch).
- Add unit tests for schema validation and URL rejection, plus an integration test against a local fixture page.

## Capabilities

### New Capabilities
- `browser-automation`: A `browser` tool that navigates, clicks, types/fills, presses keys, screenshots, extracts DOM text, waits for selectors/network idle, and evaluates JS in page context — all URL-validated and sandboxed.

### Modified Capabilities
- (none)

## Impact

- **New file**: `src/tools/browser/index.js`
- **Modified**: `src/tools/index.js` (registration)
- **Tests**: `tests/unit/tools/browser.test.js`, `tests/integration/tools/browser.test.js`
- **Dependencies**: `puppeteer-core` (already present), system Chromium (already used by `renderWeb`/`screenshotWeb`)
- **No new system dependencies** beyond the existing browser stack.
