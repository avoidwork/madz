# Proposal

## Why

The `browser` tool currently returns `JSON.stringify({ ok, ...result, sessionId })` strings from its impl function. Callers receive a serialized string rather than a native object, forcing them to `JSON.parse` the response and making the tool's contract inconsistent with other tools that return structured objects. Standardizing to native structured objects improves consistency, type safety, and downstream consumption.

## What Changes

- **BREAKING**: `browserImpl` in `src/tools/browser/index.js` returns native structured objects instead of `JSON.stringify`-wrapped strings.
  - On success: `{ ...result, sessionId }` (was `JSON.stringify({ ...result, sessionId })`).
  - On `close`: `{ ok: true, action: "close" }` (was `JSON.stringify({ ok: true, action: "close" })`).
  - On URL-rejected (SSRF validation): `{ ok: false, error: ... }` (was `JSON.stringify({ ok: false, error: ... })`).
  - On catch: `{ ok: false, error: ..., sessionId }` (was `JSON.stringify({ ok: false, error: ..., sessionId })`).
- Update JSDoc `@returns` annotations on `browserImpl` and the `browser` tool definition to reflect the native object return type.
- Update unit tests in `tests/unit/tools/browser.test.js` to assert the impl returns a native object (not a string) and to access properties directly instead of `JSON.parse`.

## Capabilities

### New Capabilities
- `browser-automation`: Drives a real headless Chromium browser — navigate, click, type/fill, press, screenshot, extract DOM text, wait for selectors/network-idle, and evaluate JS in page context, with URL validation against the sandbox allowlist. The `browser` tool returns native structured objects: success returns `{ ok: true, ...actionResult, sessionId }`; failure returns `{ ok: false, error, sessionId? }`.

### Modified Capabilities
<!-- None — `browser-automation` is not yet in the main specs; this change introduces it as a new capability with the structured-object return contract. -->

## Impact

- **Modified**: `src/tools/browser/index.js` — the `browserImpl` function return statements and JSDoc.
- **Modified**: `tests/unit/tools/browser.test.js` — assertions updated to consume native objects.
- **Dependencies**: No new dependencies — this is a refactor of existing return values.
- **Tests**: Unit tests assert the impl returns a native object on both success and failure paths.

## Non-goals

- No change to the Zod schema, session registry, or the `runAction` internal helper (it already returns native objects).
- No change to the `tool()` wrapper behavior — it passes native objects through without re-serializing.
- No new credentials, no new attack surface, no change to URL validation or SSRF protection.
- No change to error message content (the `Browser action failed: ${err.message}` format is preserved).
