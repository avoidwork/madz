## Context

madz's web toolset (`searchWeb`) is read-only. There is no first-class way to act on a web page — click, type, fill, navigate, or extract data from authenticated or JavaScript-heavy SPAs. The `src/tools/browser/browser.js` helper provides `launchBrowser` and `openPage` functions that resolve the system Chromium path (`/usr/bin/chromium`), apply the container-required `--no-sandbox --disable-dev-shm-usage` flags, and set per-call timeouts. `puppeteer-core` is already a dependency.

## Goals / Non-Goals

**Goals:**
- Add a `browser` tool that drives a real headless Chromium browser.
- Support actions: `navigate`, `click`, `type`/`fill`, `press`, `screenshot`, `extract`, `waitFor`, `evaluate`.
- Validate every outbound URL against `filterUrl` (SSRF protection).
- Return page text, a base64 screenshot (for `readImage`), or a JSON error string.
- Register the tool in `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `TOOLS`, and the `buildToolConfig` switch.
- Reuse the existing `launchBrowser`/`openPage` helpers.

**Non-Goals:**
- No persistent browser session across calls — the session is per-call and ephemeral.
- No credential storage.
- No arbitrary code execution outside the sandboxed page context.
- No bundling of a full Puppeteer download — uses `puppeteer-core` against system Chromium.

## Decisions

**Decision 1: Use `puppeteer-core` against system Chromium (not a bundled Puppeteer).**
- Rationale: `puppeteer-core` is already a dependency, and `src/tools/browser/browser.js` already resolves the system Chromium path and applies the container flags. Bundling a full Puppeteer download would bloat the image and duplicate the launch path.
- Alternative considered: shelling out to a CLI browser tool via `process` — rejected because it bypasses URL validation and is fragile.

**Decision 2: Single `browser` tool with an `action` discriminator (not one tool per action).**
- Rationale: A single tool with a discriminated Zod union keeps the tool surface small and matches the issue's proposed `browserAction` shape. It also keeps `TOOL_PERMISSIONS`/`TOOL_CLASSIFICATIONS`/`TOOLS` registration to one entry.
- Alternative considered: one tool per action (`browserNavigate`, `browserClick`, ...) — rejected as it multiplies the registration surface and the agent's tool count.

**Decision 3: Per-call ephemeral browser session, closed in `finally`.**
- Rationale: Avoids credential storage and resource leaks. Each call launches, acts, and closes the browser.
- Alternative considered: a persistent session keyed by a session id — rejected for complexity and credential-storage risk.

**Decision 4: URL validation via `filterUrl` for every navigation.**
- Rationale: Reuses the existing SSRF protection (blocks `file:`, `gopher:`, `dict:` schemes and internal/private IPs). The `evaluate` action does not navigate, so it does not need URL validation, but `navigate` and any action that takes a URL must validate.

**Decision 5: `evaluate` runs JS in page context only.**
- Rationale: `page.evaluate` executes in the sandboxed page context, not the host. It cannot escape the page. This satisfies the OWASP constraint of no arbitrary code execution outside the page context.

## Risks / Trade-offs

- **[Risk] Selector not found / timeout** → Mitigation: wrap each action in try/catch and return a JSON error string with the underlying message; set per-call timeouts on navigation and page operations.
- **[Risk] Page never reaches network idle** → Mitigation: `waitFor` supports a `networkidle` mode; `navigate` uses `networkidle0` but the caller can fall back to `domcontentloaded` via the action params.
- **[Risk] SSRF via `evaluate`** → Mitigation: `evaluate` does not navigate; only `navigate` (and any URL-bearing action) validates against `filterUrl`.
- **[Risk] Resource leak on long-running page** → Mitigation: always close the browser in a `finally` block.
- **[Risk] `evaluate` arbitrary JS** → Mitigation: restricted to `page.evaluate` (page context), never host context. Documented as a non-goal to escape the page.
