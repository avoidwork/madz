## 1. Create Sentence Detector Module

- [ ] 1.1 Create src/agent/sentence-detector.js with buffer accumulation logic
- [ ] 1.2 Implement sentence boundary detection for `.`, `!`, `?` characters
- [ ] 1.3 Handle partial chunks — buffer until complete sentence is received
- [ ] 1.4 Handle multiple sentences in one chunk — emit each separately
- [ ] 1.5 Handle edge cases: `...`, `?!`, abbreviations (`. ` followed by whitespace = boundary)
- [ ] 1.6 Write unit tests for sentence detector (boundary detection, buffering, edge cases)

## 2. Create Sliding Window Tracker Module

- [ ] 2.1 Create src/agent/sliding-window-tracker.js with timestamped sentence storage
- [ ] 2.2 Implement 30-second sliding window that releases old sentences
- [ ] 2.3 Implement sentence normalization (trim whitespace, lowercase) for frequency tracking
- [ ] 2.4 Implement frequency counting per normalized sentence
- [ ] 2.5 Write unit tests for sliding window (add, expire, frequency counting, normalization)

## 3. Implement Loop Detection Logic

- [ ] 3.1 Integrate sentence detector and sliding window tracker into a loop detection pipeline
- [ ] 3.2 Implement threshold check: trigger when any sentence appears >3 times in window
- [ ] 3.3 Emit `{ type: 'loop_detected' }` callback event when threshold is exceeded
- [ ] 3.4 Write unit tests for loop detection (threshold trigger, no false positives)

## 4. Integrate with Streaming Pipeline

- [ ] 4.1 Read src/agent/react.js `callReactAgentStreaming()` function (lines 263-400)
- [ ] 4.2 Integrate sentence sampler into the `on_chat_model_stream` event handler (line 337)
- [ ] 4.3 Sampler intercepts chunks without modifying them before passing to callback
- [ ] 4.4 Sampler is positioned between raw chunk processing and callback invocation
- [ ] 4.5 Implement per-stream sampler state (reset on stream end/abort)
- [ ] 4.6 Ensure stream cleanup resets sampler state and prevents memory leaks

## 5. Implement Silent Loop Nudge

- [ ] 5.1 Follow existing `RECURSION_LIMIT_MESSAGE` pattern from react.js line 53
- [ ] 5.2 Inject "You're looping." nudge as a silent message into the streaming pipeline
- [ ] 5.3 Ensure nudge is non-disruptive — doesn't interrupt stream or confuse the agent
- [ ] 5.4 Handle `{ type: 'loop_detected' }` events in the callback pipeline

## 6. Update TUI Message Handling

- [ ] 6.1 Read src/tui/messages.js message state tracking (lines 9-49)
- [ ] 6.2 Handle loop_detected nudge as a silent, non-intrusive message type
- [ ] 6.3 Ensure TUI distinguishes between streaming and non-streaming messages for the nudge
- [ ] 6.4 Verify nudge appears silently without disrupting the user experience

## 7. Integration Testing

- [ ] 7.1 Test sentence detection with real streaming chunk patterns
- [ ] 7.2 Test loop detection with repetitive streaming text
- [ ] 7.3 Test nudge injection and TUI handling
- [ ] 7.4 Test stream cleanup and state reset on abort/complete
- [ ] 7.5 Test concurrent streams have independent samplers

## 8. Verification

- [ ] 8.1 Run npm run test — all tests pass
- [ ] 8.2 Run npm run lint — no lint errors
- [ ] 8.3 Run npm run coverage — coverage maintained
- [ ] 8.4 Run npm start — application starts without crashing