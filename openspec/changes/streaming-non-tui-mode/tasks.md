## 1. Implement stdout callback

- [ ] 1.1 Create `createStdoutCallback()` function in `src/agent/react.js` that returns a callback writing text chunks to stdout and loop_detected to stderr
- [ ] 1.2 Ensure non-text events (tool_start, tool_end, reasoning, compaction) are silently ignored by the stdout callback

## 2. Modify callReactAgent to always stream

- [ ] 2.1 Update `callReactAgent()` to always pass a callback to `callReactAgentStreaming()` — use user-provided callback or default stdout callback
- [ ] 2.2 Remove the non-streaming `agent.invoke()` code path from `callReactAgent()`
- [ ] 2.3 Verify the function still returns `{ content: string }` for API compatibility

## 3. Write unit tests

- [ ] 3.1 Test `createStdoutCallback()` writes text chunks to stdout without extra newlines
- [ ] 3.2 Test `createStdoutCallback()` writes loop_detected events to stderr
- [ ] 3.3 Test `createStdoutCallback()` ignores non-text events (tool_start, tool_end, reasoning, compaction)
- [ ] 3.4 Test `callReactAgent()` without callback uses streaming and returns correct content
- [ ] 3.5 Test `callReactAgent()` with user-provided callback uses the provided callback (TUI mode preserved)

## 4. Verify and commit

- [ ] 4.1 Run `npm run test` and verify all tests pass
- [ ] 4.2 Run `npm run lint` and verify lint passes
- [ ] 4.3 Run `npm run coverage` and verify 100% coverage is maintained
- [ ] 4.4 Verify application starts without crashing (`timeout 10 npm start`)