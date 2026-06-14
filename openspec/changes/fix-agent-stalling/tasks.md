## 1. Update Recursion Limit Default

- [ ] 1.1 Update `index.js` to set default recursion limit to 50
- [ ] 1.2 Update `config.yaml` to document `agent.recursionLimit` as configurable

## 2. Fix Streaming Fallback in `callReactAgentStreaming`

- [ ] 2.1 Add `hasTextContent` tracking variable in `callReactAgentStreaming`
- [ ] 2.2 Set `hasTextContent = true` whenever a text event is emitted
- [ ] 2.3 Replace `originalMessage` fallback with `RECURSION_LIMIT_MESSAGE` when `hasTextContent` is false
- [ ] 2.4 Ensure compaction paths still work correctly (emit compaction_end, continue loop)

## 3. Add Tests

- [ ] 3.1 Add test: stream completes with text → returns text content
- [ ] 3.2 Add test: stream completes without text → returns recursion limit message
- [ ] 3.3 Add test: stream completes with reasoning but no text → returns recursion limit message
- [ ] 3.4 Add test: context length compaction still works after changes
- [ ] 3.5 Add test: GraphRecursionError still handled correctly

## 4. Verify

- [ ] 4.1 Run `npm run test` — all tests pass
- [ ] 4.2 Run `npm run lint` — no lint errors
- [ ] 4.3 Run `npm run coverage` — coverage maintained
