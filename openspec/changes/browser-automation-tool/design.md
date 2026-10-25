## Context

madz's web toolset (`searchWeb`, `extractWeb`, `renderWeb`, `screenshotWeb`) is read-only. The browser stack already exists: `src/tools/web/browser.js` provides `launchBrowser` and `openPage` against system Chromium via `puppeteer-core`, and `src/sandbox/urlFilter.js` provides `filterUrl` for SSRF-safe URL validation. This change adds a `browser` tool that reuses that stack to *act* on pages — click, type, fill, navigate, press, screenshot, extract, wait, and evaluate.

## Goals / Non-Goals

**Goals:**
- Provide a single `browser` tool with an `action` discriminator covering the common browser-automation primitives.
- Reuse `launchBrowser`/`openPage` and `filterUrl` rather than duplicating browser/URL logic.
- Keep the browser session ephemeral and scoped to the sandbox.
- Register the tool in `src/tools/index.js` with `network:outbound` permission.

**Non-Goals:**
- No credential storage or persistent login sessions.
- No arbitrary code execution outside the sandboxed page context.
- No new system dependencies beyond the existing `puppeteer-core` + system Chromium.

## Decisions

### Decision 1: Single tool with an `action` discriminator (vs. one tool per action)

Use a single `browser` tool whose Zod schema is a discriminated union on `action`. Rationale: a single tool keeps the tool surface small, mirrors the existing web tools' single-tool-per-domain pattern, and lets the agent express a multi-step interaction as a sequence of `browser` calls. Alternative (one tool per action) rejected: it would add eight near-identical tools and bloat `TOOL_PERMISSIONS`/`TOOL_CLASSIFICATIONS`.

### Decision 2: Reuse `launchBrowser`/`openPage` from `src/tools/web/browser.js`

Import and reuse the existing helpers. Rationale: they already handle Chromium path resolution, `--no-sandbox`/`--disable-dev-shm-usage` flags, and per-call timeouts. The impl accepts `options.launchBrowser`/`options.openPage` for test injection, mirroring `renderWebImpl`/`screenshotWebImpl`.

### Decision 3: Validate every outbound URL against `filterUrl`

Before any `navigate` (and before `evaluate`/`waitFor` that could trigger navigation), validate the URL with `filterUrl(url, [])`. Rationale: consistent with `renderWeb`/`screenshotWeb`; blocks `file:`/`gopher:`/`dict:` schemes and internal/private IPs (SSRF protection).

### Decision 4: Return JSON result strings consistent with existing web tools

Return `{ ok: true, ... }` on success and `{ ok: false, error }` on failure, matching `renderWebImpl`/`screenshotWebImpl`. Rationale: the agent and tool harness already parse this shape.

### Decision 5: `screenshot` returns base64 for `readImage`

The `screenshot` action returns a base64-encoded image (and optionally a saved path), so the agent can feed it to `readImage` for vision. Rationale: consistent with the read-image vision dispatch path.

## Risks / Trade-offs

- **[Selector not found]** → Return `{ ok: false, error }` with a clear message; do not throw.
- **[Navigation timeout]** → Apply `DEFAULT_TIMEOUT` per call; on timeout, close the browser and return an error.
- **[Page never reaches network idle]** → Use `waitUntil: "domcontentloaded"` for `navigate` and expose a `waitFor` action for explicit selector/network-idle waits.
- **[`evaluate` runs arbitrary JS]** → Restrict to the page context only; never expose host APIs. The tool runs inside the sandboxed page, not the host process.
- **[Browser resource exhaustion]** → Always close the browser in a `finally` block; per-call timeout guards runaway pages.
