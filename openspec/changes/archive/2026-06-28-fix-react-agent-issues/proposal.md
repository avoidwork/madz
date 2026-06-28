## Why

The React agent in `src/agent/react.js` has a medium-severity regex false positive in `isContextLengthError` that triggers unnecessary context compaction on rate limit errors. Additionally, there are several low-severity issues including dead code (`agent.stepTimeout`), redundant `recursionLimit` parameter, missing JSDoc documentation, and significant test coverage gaps across cache hits, version parameters, and timeout assignments.

## What Changes

- Narrow `CONTEXT_LENGTH_PATTERN_2` regex in `src/tools/compact_context.js` to only match context length errors, not rate limit or other "limit" errors
- Remove dead `agent.stepTimeout = timeout` assignment in `src/agent/react.js` (LangGraph's `streamEvents` does not read this property)
- Remove redundant `recursionLimit` from `createReactAgentGraph` construction call, keeping only the invocation-time value in `streamEvents`
- Add JSDoc documentation for `turnHashWindow` and `turnBufferMax` options in `callReactAgent`
- Add test coverage for cache hit path, `streamEvents` version parameter, `isContextLengthError` false positive detection, `recursionLimit` in `streamEvents` options, and `agent.stepTimeout` removal

## Capabilities

### New Capabilities
<!-- No new capabilities being introduced — this is a bug fix and test coverage improvement -->

### Modified Capabilities
- `context-compaction`: Modified requirement — `isContextLengthError` must only match context length errors, not rate limit or other "limit" errors

## Impact

- **Affected code:** `src/tools/compact_context.js`, `src/agent/react.js`
- **Affected tests:** `tests/unit/tools/compact_context.test.js`, `tests/unit/agent/react.test.js`
- **Behavioral change:** Rate limit errors will no longer trigger unnecessary context compaction attempts
- **No breaking changes:** This is a bug fix that corrects incorrect behavior