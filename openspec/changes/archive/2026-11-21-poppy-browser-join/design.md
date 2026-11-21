# Design

## Context

See proposal.md - Why. The `poppy` tool already has per-action modules (`discovery`, `identity`, `session`, `oauth`, `verify`, `api`, `conversation`) dispatched via the `ACTIONS` registry in `src/tools/poppy/index.js`. The project already ships a browser backend (`puppeteer-core` via `src/tools/browser/browser.js`) that is excluded from coverage. The `poppy.json` document already carries `web.browser_session_endpoint`, `web.disabled`, and `web.unscoped` (see `src/tools/poppy/discovery.js`).

## Goals / Non-Goals

**Goals:**
- Add a `browser` action to the `poppy` tool that joins a company's browser session.
- Reuse the existing browser backend and Poppy HTTP helpers.
- Enforce the `poppy:browser-sign-in` scope and handle `web.disabled` / `web.unscoped`.

**Non-Goals:**
- Modifying the generic `browser` tool.
- Adding playwright as a new dependency (the project already uses puppeteer-core).
- Changes to other Poppy channels.

## Decisions

- **Reuse the existing browser backend** (`launchBrowser`/`openPage` from `src/tools/browser/browser.js`) rather than adding playwright. Rationale: the project already depends on puppeteer-core and the browser tool is excluded from coverage; adding playwright would be a new dependency with no benefit. Alternative considered: playwright (per the issue) — rejected to avoid a new dependency.
- **Authorize via `fetchJson`** from `./common.js`, sending the `Poppy-Session` header and, if signed in, the access token with `poppy:browser-sign-in` scope. The access token is only sent in the authorize request headers, never through the browser.
- **Read the code only from the agent's own browser page** via DOM extraction after top-level navigation to the `browser_session_endpoint`.
- **Validate the code and join response against Zod schemas** (`BrowserInputSchema`, plus response validation), consistent with the other Poppy modules.
- **Handle `web.disabled` / `web.unscoped`** by rejecting when disabled and bypassing the scope requirement when unscoped.

## Risks / Trade-offs

- [Browser control is environment-dependent] → Reuse the existing `launchBrowser`/`openPage` helpers and the container Chromium path resolution; the browser module is excluded from coverage.
- [Access token leakage] → Never send the token through the browser; only in the authorize request headers.
- [Code expiry / already-authorized] → Return explicit error results for expired or already-authorized codes.
