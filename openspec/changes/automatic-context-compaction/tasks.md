## 1. Create compactContext tool

- [ ] 1.1 Create `src/tools/compactContext.js` with compactContext implementation
- [ ] 1.2 Implement tiered retention strategy (always retain, summarize, drop)
- [ ] 1.3 Implement fallback logic for extreme budget constraints
- [ ] 1.4 Register compactContext tool in `src/tools/index.js`

## 2. Add error detection and retry logic

- [ ] 2.1 Add context length error detection regex in `src/agent/react.js`
- [ ] 2.2 Implement retry loop in `callReactAgent` with compaction trigger
- [ ] 2.3 Implement retry loop in `callReactAgentStreaming` with compaction trigger
- [ ] 2.4 Add max compaction iteration limit (3 iterations)
- [ ] 2.5 Add fallback error message when compaction cannot succeed

## 3. Integration and configuration

- [ ] 3.1 Wire up config.maxTokens access in error detection
- [ ] 3.2 Ensure checkpointer conversation access works with compaction
- [ ] 3.3 Add logging for compaction events

## 4. Tests

- [ ] 4.1 Write tests for compactContext tool (normal compaction)
- [ ] 4.2 Write tests for compactContext tool (edge cases: minimal budget, empty conversation)
- [ ] 4.3 Write tests for error detection regex (OpenAI format, variant formats, non-matching errors)
- [ ] 4.4 Write tests for retry loop (single success, multiple iterations, max iterations reached)
- [ ] 4.5 Write integration tests for end-to-end compaction flow
