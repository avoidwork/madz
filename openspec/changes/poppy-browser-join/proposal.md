# Proposal

## Why

Poppy lets a personal agent browse a company's website in the same session it uses for APIs and conversations. Today madz has Poppy channels for discovery, identity, session, OAuth, verify, API, and conversation, but no browser channel. This change adds the browser join flow so a company sees one session across browsing, APIs, and conversations.

## What Changes

- Add a `browser` action to the `poppy` tool that joins a company's browser session.
- The action loads the company's `browser_session_endpoint` in the agent's browser (top-level navigation), reads the one-time code from the page, authorizes it via `POST {browser_session_endpoint}/authorize`, submits the form to set the session cookie, and browses the website with the session cookie.
- Enforce the `poppy:browser-sign-in` scope when sending the access token, and handle `web.disabled` / `web.unscoped` settings.
- Take the code only from the agent's own browser; never send the access token through the browser.

## Capabilities

### New Capabilities
- `poppy-browser-join`: Lets madz's browser join a company's browser session via the Poppy browser-session endpoint, authorizing a one-time code and setting the session cookie so the company sees one session across browsing, APIs, and conversations.

### Modified Capabilities
- (none)

## Impact

- `src/tools/poppy/browser.js` (new): the `browser` action module.
- `src/tools/poppy/index.js`: extend `ACTIONS`, `poppySchema`, and the tool description with the `browser` action.
- `tests/unit/tools/poppy/browser.test.js` (new): unit tests for code authorization, cookie handling, scope enforcement.
- `tests/integration/tools/poppy/browser.test.js` (new): integration test running the join flow against a mock browser-session endpoint.
- Reuses `fetchJson` from `src/tools/poppy/common.js` and `validateUrl` from `src/tools/poppy/discovery.js`, plus the existing browser backend (`puppeteer-core` via `src/tools/browser/browser.js`).
