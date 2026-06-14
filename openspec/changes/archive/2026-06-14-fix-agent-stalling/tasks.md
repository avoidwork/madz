## 1. Update Recursion Limit Default

- [x] 1.1 Update `index.js` to set default recursion limit to 50
- [x] 1.2 Update `config.yaml` to document `agent.recursionLimit` as configurable

## 2. Fix Streaming Fallback in `callReactAgentStreaming`

- [x] 2.1 Add `hasTextContent` tracking variable in `callReactAgentStreaming`
- [x] 2.2 Set `hasTextContent = true` whenever a text event is emitted
- [x] 2.3 Replace `originalMessage` fallback with `RECURSION_LIMIT_MESSAGE` when `hasTextContent` is false
- [x] 2.4 Ensure compaction paths still work correctly (emit compaction_end, continue loop)

## 3. Add Tests

- [x] 3.1 Add test: stream completes with text → returns text content
- [x] 3.2 Add test: stream completes without text → returns recursion limit message
- [x] 3.3 Add test: stream completes with reasoning but no text → returns recursion limit message
- [x] 3.4 Add test: context length compaction still works after changes
- [x] 3.5 Add test: GraphRecursionError still handled correctly

## 4. Verify

- [x] 4.1 Run `npm run test` — all tests pass
- [x] 4.2 Run `npm run lint` — no lint errors
- [x] 4.3 Run `npm run coverage` — coverage maintained
