## Context

The `extractWeb` tool in `src/tools/web/index.js` performs a plain `fetch()` and regex-strips HTML tags. It works on static pages but is blind to JavaScript-rendered content — SPAs, dashboards, paywalled content, bot-protected pages. The `readImage` tool already base64-encodes images for vision analysis, so if the agent can *produce* a screenshot, it can *see* it.

The Dockerfile already installs Chromium via `apt-get install ... chromium ...` but references it nowhere in the codebase. This change makes that system Chromium earn its keep by adding real browsing capability.

## Goals / Non-Goals

**Goals:**
- Add `puppeteer-core` as a project dependency, pointed at the system Chromium via `executablePath`.
- Add a `renderWeb` tool that renders a URL in headless Chromium and returns JS-aware extracted text.
- Add a `screenshotWeb` tool that renders a URL and returns a base64 PNG for vision analysis.
- Register both tools in `src/tools/index.js` across `TOOLS`, `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, and `ORCHESTRATOR_TOOLS`.
- Validate all outbound URLs against the sandbox URL allowlist (`filterUrl`) before launching the browser.

**Non-Goals:**
- Replacing `extractWeb` — it stays as the fast path for static pages.
- Adding Playwright or a full browser test runner — `puppeteer-core` + system Chromium is sufficient.
- Cross-browser support — only system Chromium is targeted.
- Modifying `searchWeb` — search is not the gap.

## Decisions

### Decision: Use `puppeteer-core` over Playwright

`puppeteer-core` is designed to use an existing browser and bundles nothing — no 150MB browser download. It points at `/usr/bin/chromium` via `executablePath`. Playwright (full) downloads its own Chromium/Firefox/WebKit on install, duplicating the system Chromium and bloating the image. Playwright-core can use system Chromium but expects its own patched browser build; version mismatches are more common.

### Decision: Shared browser-launch helper

A shared helper (`src/tools/web/browser.js`) resolves the system Chromium path, launches with `--no-sandbox --disable-dev-shm-usage` (mandatory in a container running as non-root `madz`; `/dev/shm` is tiny in containers), and applies a per-call timeout. Both `renderWeb` and `screenshotWeb` reuse it, avoiding duplication (DRY).

### Decision: URL validation via `filterUrl`

Reuse `src/sandbox/urlFilter.js` `filterUrl(url, allowlist)` for URL validation before launching the browser, consistent with `extractWeb`. This blocks `file:`/`gopher:`/`dict:` schemes and internal IPs, satisfying the OWASP outbound-request allowlist requirement (AGENTS.md §1.2).

### Decision: Tool registration in all four maps

New tools must be added to `TOOLS`, `TOOL_PERMISSIONS` (`network:outbound`), `TOOL_CLASSIFICATIONS` (`["search", "research", "coding"]`), and `ORCHESTRATOR_TOOLS` in `src/tools/index.js`, matching the existing `extractWeb`/`searchWeb` pattern.

## Risks / Trade-offs

- [Chromium may not launch in the slim image] → Probe it, don't assume. Verify Chromium actually launches before trusting the implementation; launch with `--no-sandbox --disable-dev-shm-usage`.
- [Resource exhaustion from unbounded browser launches] → Apply a per-call timeout on every browser launch.
- [Screenshot size may be large] → Return base64 PNG; `readImage` enforces `image.maxSize` (default `100kb`) so large screenshots may be rejected downstream — acceptable, the tool returns the data and the caller decides.
- [Non-HTML content] → Handle gracefully by returning an error or the raw content.
