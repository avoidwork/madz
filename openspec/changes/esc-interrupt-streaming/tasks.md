## 1. Add Streaming State Tracking

- [ ] 1.1 Add `isStreamingRef` ref to `src/tui/app.js` to track whether agent is currently streaming
- [ ] 1.2 Add `interruptRef` ref to `src/tui/app.js` to signal interruption to the streaming loop

## 2. Modify TUI Key Handling

- [ ] 2.1 Update `useInput` handler in `src/tui/app.js` to check `isStreamingRef.current` before handling 'esc'
- [ ] 2.2 When streaming and 'esc' is pressed, set `interruptRef.current = true` instead of calling `handleQuit()`
- [ ] 2.3 Ensure 'esc' still calls `handleQuit()` when NOT streaming (onboarding, banner, idle states)

## 3. Pass Interrupt Signal Through Provider Layer

- [ ] 3.1 Modify `dispatchProvider` in `index.js` to accept and pass interrupt ref to `callProvider`
- [ ] 3.2 Modify `callProvider` in `index.js` to pass interrupt ref to `callReactAgent`
- [ ] 3.3 Update streaming callback closure to include interrupt ref check

## 4. Implement Stream Interruption in Agent Layer

- [ ] 4.1 Modify `callReactAgentStreaming` in `src/agent/react.js` to accept interrupt ref parameter
- [ ] 4.2 Add interrupt check at the start of each iteration in the `for await` loop
- [ ] 4.3 Break the stream loop when interrupt signal is detected
- [ ] 4.4 Clean up state after interruption (emit compaction_end if active, clear tool call sets)

## 5. Update Message State After Interruption

- [ ] 5.1 Update message state to mark streaming as false when interrupted
- [ ] 5.2 Preserve partial content in `committedContent` and `committedReasoning`
- [ ] 5.3 Reset `interruptRef.current` to false after interruption

## 6. Add Tests

- [ ] 6.1 Add unit test for 'esc' interrupt during streaming
- [ ] 6.2 Add unit test for 'esc' exit when not streaming
- [ ] 6.3 Add integration test for stream interruption and UI state
- [ ] 6.4 Add edge case tests (rapid esc presses, esc during tool calls)

## 7. Verify and Clean Up

- [ ] 7.1 Run existing test suite to ensure no regressions
- [ ] 7.2 Run lint to ensure code quality
- [ ] 7.3 Manual testing: verify esc interrupts streaming and preserves app
- [ ] 7.4 Manual testing: verify esc still exits in non-streaming states
