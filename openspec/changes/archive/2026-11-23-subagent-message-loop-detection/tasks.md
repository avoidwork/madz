# Tasks

## 1. Implementation

- [x] 1.1 In `src/stream/consume.js` `drainStream`, add an `else if (includeSubagent)` branch to the message-text block that pushes subagent message text to the loop detector keyed by `subagentId(namespace)`, and verify the subagent message loop-detection tests pass.

## 2. Tests

- [x] 2.1 In `tests/unit/stream/loopDetectorMessageEnd.test.js`, add a subagent message loop-detection describe block (flag repeating subagent message text, do not flag varied text, key concurrent subagents separately, do not feed when `subagent: false`, release state at turn end) and verify the tests pass.
- [x] 2.2 In `tests/unit/stream/loopDetector.test.js`, add a `consumeStream` test that a looping subagent message stream is detected by default and not detected when `subagent: false`, and verify the tests pass.
- [x] 2.3 In `tests/unit/stream/loopDetectorStreams.test.js`, add a test that subagent message text is keyed per subagent so concurrent subagent message streams do not mix, and verify the tests pass.

## 3. Verification

- [x] 3.1 Run `npm run lint`, `npm run test`, and `npm run coverage` and verify all pass with maintained coverage.
