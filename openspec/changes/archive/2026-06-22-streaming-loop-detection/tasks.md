## 1. Create Sentence Detector Module

- [x] 1.1 Create src/agent/sentence-detector.js with buffer accumulation logic
- [x] 1.2 Implement sentence boundary detection for `.`, `!`, `?` characters
- [x] 1.3 Handle partial chunks — buffer until complete sentence is received
- [x] 1.4 Handle multiple sentences in one chunk — emit each separately
- [x] 1.5 Handle edge cases: `...`, `?!`, abbreviations (`. ` followed by whitespace = boundary)
- [x] 1.6 Write unit tests for sentence detector (boundary detection, buffering, edge cases)

## 2. Create Sliding Window Tracker Module

- [x] 2.1 Create src/agent/sliding-window-tracker.js with timestamped sentence storage
- [x] 2.2 Implement 30-second sliding window that releases old sentences
- [x] 2.3 Implement sentence normalization (trim whitespace, lowercase) for frequency tracking
- [x] 2.4 Implement frequency counting per normalized sentence
- [x] 2.5 Write unit tests for sliding window (add, expire, frequency counting, normalization)

## 3. Implement Loop Detection Logic

- [x] 3.1 Integrate sentence detector and sliding window tracker into a loop detection pipeline
- [x] 3.2 Implement threshold check: trigger when any sentence appears >3 times in window
- [x] 3.3 Emit `{ type: 'loop_detected' }` callback event when threshold is exceeded
- [x] 3.4 Write unit tests for loop detection (threshold trigger, no false positives)

## 4. Integrate with Streaming Pipeline

- [x] 4.1 Read src/agent/react.js `callReactAgentStreaming()` function (lines 263-400)
- [x] 4.2 Integrate sentence sampler into the `on_chat_model_stream` event handler (line 337)
- [x] 4.3 Sampler intercepts chunks without modifying them before passing to callback
- [x] 4.4 Sampler is positioned between raw chunk processing and callback invocation
- [x] 4.5 Implement per-stream sampler state (reset on stream end/abort)
- [x] 4.6 Ensure stream cleanup resets sampler state and prevents memory leaks

## 5. Implement Silent Loop Nudge

- [x] 5.1 Follow existing `RECURSION_LIMIT_MESSAGE` pattern from react.js line 53
- [x] 5.2 Inject "You're looping." nudge as a silent message into the streaming pipeline
- [x] 5.3 Ensure nudge is non-disruptive — doesn't interrupt stream or confuse the agent
- [x] 5.4 Handle `{ type: 'loop_detected' }` events in the callback pipeline

## 6. Update TUI Message Handling

- [x] 6.1 Read src/tui/messages.js message state tracking (lines 9-49)
- [x] 6.2 Handle loop_detected nudge as a silent, non-intrusive message type
- [x] 6.3 Ensure TUI distinguishes between streaming and non-streaming messages for the nudge
- [x] 6.4 Verify nudge appears silently without disrupting the user experience

## 7. Integration Testing

- [x] 7.1 Test sentence detection with real streaming chunk patterns
- [x] 7.2 Test loop detection with repetitive streaming text
- [x] 7.3 Test nudge injection and TUI handling
- [x] 7.4 Test stream cleanup and state reset on abort/complete
- [x] 7.5 Test concurrent streams have independent samplers

## 8. Verification

- [x] 8.1 Run npm run test — all tests pass
- [x] 8.2 Run npm run lint — no lint errors
- [x] 8.3 Run npm run coverage — coverage maintained
- [x] 8.4 Run npm start — application starts without crashing