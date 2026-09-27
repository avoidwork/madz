## Why

The `extractWeb` tool performs a plain `fetch()` and regex-strips HTML tags. It is blind to JavaScript-rendered content — SPAs, dashboards, paywalled pages, and bot-protected pages. The system Chromium installed in the Dockerfile is currently dead weight, referenced nowhere in the codebase. This change turns that unused Chromium into real browsing capability so the agent can render JS-heavy pages and capture screenshots for vision analysis.

## What Changes

- Add `puppeteer-core` as a project dependency (not a global module), pointed at the system Chromium via `executablePath`.
- Add a shared browser-launch helper that resolves the system Chromium path, launches with `--no-sandbox --disable-dev-shm-usage`, and applies a per-call timeout.
- Add a `renderWeb` tool that renders a URL in headless Chromium and returns JS-aware extracted text.
- Add a `screenshotWeb` tool that renders a URL and returns a base64 PNG, feeding the existing `readImage` tool for vision analysis.
- Register both tools in `src/tools/index.js` across `TOOLS`, `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, and `ORCHESTRATOR_TOOLS`.
- Validate all outbound URLs against the sandbox URL allowlist (`filterUrl`) before launching the browser, consistent with `extractWeb`.
- Add unit and integration tests mirroring the existing `tests/unit/tools/` structure.

## Non-goals

- Replacing `extractWeb` — it stays as the fast path for static pages.
- Adding Playwright or a full browser test runner — `puppeteer-core` + system Chromium is sufficient.
- Cross-browser support — only system Chromium is targeted.
- Modifying `searchWeb` — search is not the gap.

## Capabilities

### New Capabilities
- `render-web`: Render a URL in headless Chromium and return JS-aware extracted text.
- `screenshot-web`: Render a URL in headless Chromium and return a base64 PNG for vision analysis.

### Modified Capabilities
<!-- No existing spec-level behavior changes. -->

## Impact

- **Dependencies**: `puppeteer-core` added to `package.json` dependencies (flows through the builder stage `npm ci`).
- **System dependency**: Chromium already installed in the Dockerfile via `apt-get install ... chromium ...`; must be launched with `--no-sandbox --disable-dev-shm-usage` (non-root `madz` user, tiny `/dev/shm` in containers).
- **Code**: `src/tools/web/index.js` (or sibling `src/tools/web/` module), `src/tools/index.js` registration maps, `src/sandbox/urlFilter.js` (reused for validation).
- **Tests**: `tests/unit/tools/web.test.js` (or sibling) covering schema validation, invalid URL rejection, and timeout handling.
