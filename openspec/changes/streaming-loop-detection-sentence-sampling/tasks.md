## 1. Setup

- [ ] 1.1 Create new module structure for sentence-sampling and loop-detection modules
- [ ] 1.2 Add JSDoc comments and module exports for new files

## 2. Sentence Boundary Detector

- [ ] 2.1 Implement sentence buffer that accumulates streaming text chunks
- [ ] 2.2 Implement sentence boundary detection on `.`, `!`, or `?`
- [ ] 2.3 Handle edge cases: ellipses (`...`), multiple punctuation (`?!`), abbreviations
- [ ] 2.4 Emit complete sentences only (no partial sentences)
- [ ] 2.5 Write unit tests for sentence boundary detection

## 3. Sliding Window Tracker

- [ ] 3.1 Implement sliding window data structure with timestamp-based expiration
- [ ] 3.2 Implement sentence frequency tracking within the window
- [ ] 3.3 Implement old sentence expiration (30-second window)
- [ ] 3.4 Ensure no memory leaks or unbounded growth
- [ ] 3.5 Write unit tests for sliding window behavior

## 4. Loop Detection

- [ ] 4.1 Implement loop detection logic that triggers on 3+ repetitions
- [ ] 4.2 Emit loop detection event (`{ type: 'loop_detected' }`)
- [ ] 4.3 Ensure no false positives on 2 repetitions or different sentences
- [ ] 4.4 Write unit tests for loop detection

## 5. Nudge Emission Integration

- [ ] 5.1 Integrate sentence sampler into `src/agent/react.js` streaming event loop
- [ ] 5.2 Hook into `on_chat_model_stream` event processing (around line 337)
- [ ] 5.3 Emit silent "You're looping." nudge following `RECURSION_LIMIT_MESSAGE` pattern
- [ ] 5.4 Ensure nudge is non-disruptive to user experience
- [ ] 5.5 Write integration tests for nudge emission

## 6. TUI Message Handling

- [ ] 6.1 Verify TUI handles the loop detection nudge gracefully in `src/tui/messages.js`
- [ ] 6.2 Ensure nudge is displayed silently without disrupting streaming
- [ ] 6.3 Write tests for TUI nudge handling

## 7. Verification

- [ ] 7.1 Run full test suite and verify all tests pass
- [ ] 7.2 Run lint and verify no lint errors
- [ ] 7.3 Verify application starts without crashing
- [ ] 7.4 Manual verification: test loop detection with repetitive streaming input