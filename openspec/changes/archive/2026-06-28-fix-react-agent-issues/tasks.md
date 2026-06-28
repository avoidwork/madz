## 1. Fix `isContextLengthError` regex

- [ ] 1.1 Update `CONTEXT_LENGTH_PATTERN_2` in `src/tools/compact_context.js` from `/limit[:\s]*(\d+)/i` to `/context.*limit[:\s]*(\d+)/i`
- [ ] 1.2 Verify existing tests for context length errors still pass
- [ ] 1.3 Add test for false positive detection — rate limit errors should NOT trigger compaction

## 2. Remove dead `agent.stepTimeout` code

- [ ] 2.1 Remove `agent.stepTimeout = timeout` assignment from `src/agent/react.js` (line ~103)
- [ ] 2.2 Verify no other code depends on `agent.stepTimeout`
- [ ] 2.3 Add test confirming the property is not set

## 3. Remove redundant `recursionLimit` at construction time

- [ ] 3.1 Remove `recursionLimit` from `createReactAgentGraph` call in `src/agent/react.js` (line ~100)
- [ ] 3.2 Keep `recursionLimit` in `streamEvents` options (line ~212)
- [ ] 3.3 Add test confirming `recursionLimit` is passed to `streamEvents`

## 4. Add JSDoc documentation

- [ ] 4.1 Add `@param turnHashWindow` description to `callReactAgent` JSDoc
- [ ] 4.2 Add `@param turnBufferMax` description to `callReactAgent` JSDoc

## 5. Add missing test coverage

- [ ] 5.1 Add test for cache hit path in `callReactAgent` (lines 222-231)
- [ ] 5.2 Add test for `streamEvents` version parameter (line 279 passes `version: "v2"`)
- [ ] 5.3 Add test for `isContextLengthError` false positive detection
- [ ] 5.4 Add test for `recursionLimit` in `streamEvents` options
- [ ] 5.5 Add test confirming `agent.stepTimeout` is not set (after removal)

## 6. Verify and commit

- [ ] 6.1 Run `npm run test` and verify all tests pass
- [ ] 6.2 Run `npm run lint` and verify lint passes
- [ ] 6.3 Run `npm run coverage` and verify 100% coverage is maintained
- [ ] 6.4 Verify application starts without crashing (`npm start`)