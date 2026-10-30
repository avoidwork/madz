# Proposal

## Why

The `searchWeb` tool currently returns a `JSON.stringify({ ok, backend, query, results })` string from its impl function. This forces callers to parse the response and makes the tool's contract inconsistent with other tools that return native structured objects. Standardizing to native structured objects improves consistency, type safety, and downstream consumption.

## What Changes

- `searchWebImpl` success path returns a native object `{ ok: true, backend, query, results }` instead of a `JSON.stringify` string.
- `searchWebImpl` failure paths return native objects `{ ok: false, error }` instead of `JSON.stringify` strings.
- JSDoc `@returns` annotations for `searchWebImpl` and the `searchWeb` tool definition are updated to reflect the native object return type.
- Unit tests in `tests/unit/tools/web.test.js` are updated to assert the native object shape instead of `JSON.parse(result)`.

## Capabilities

### New Capabilities
- `web-search-tool`: The response contract of the `searchWeb` tool — the shape of the structured object returned on success (`{ ok: true, backend, query, results }`) and on failure (`{ ok: false, error }`).

### Modified Capabilities
<!-- No existing capability's requirements change at the spec level. The `web-search-config` spec covers configuration, not the return contract. -->

## Impact

- **Code**: `src/tools/web/index.js` — `searchWebImpl` function and its JSDoc, plus the `searchWeb` tool definition JSDoc.
- **Tests**: `tests/unit/tools/web.test.js` — update assertions to check native object shape.
- **Dependencies**: No new dependencies.
- **Breaking**: Callers that currently `JSON.parse` the returned string will need to consume the native object directly.

## Non-goals

- No change to the search backend implementations (`searchWithBing`, `searchWithDuckDuckGo`, etc.).
- No change to the `searchWeb` tool's input schema or the `detectSearchBackend` logic.
- No change to the `web-search-config` spec or configuration handling.
