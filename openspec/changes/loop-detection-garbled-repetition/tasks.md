# Tasks

## 1. Core Implementation

- [ ] 1.1 Add `normalize(sentence)` and `similarity(a, b)` helpers to `src/stream/loopCheck.js` and verify the unit tests for them pass
- [ ] 1.2 Add `hasSimilarSentence(sentences, threshold, similarityThreshold)` to `src/stream/loopCheck.js` and wire it into `checkLoop` as an additional branch, keeping the exact-match and word-run checks as a fast path; verify the loopCheck unit tests pass
- [ ] 1.3 Add a `similarityThreshold` option (default 0.85) to `createSegmentLoopDetector` in `src/stream/loopDetector.js` and include it in the task payload built in `startCheck`; verify the loopDetector unit tests pass
- [ ] 1.4 Add `similarityThreshold` to `LoopDetectionSchema` in `src/config/schemas/loopDetection.js` (default 0.85); verify the config schema test passes

## 2. Regression Tests

- [ ] 2.1 Add unit tests in `tests/unit/stream/loopCheck.test.js` for `normalize`, `similarity`, and `hasSimilarSentence`, including a negative case ensuring distinct sentences are not flagged; verify the loopCheck tests pass
- [ ] 2.2 Add a regression test in `tests/unit/stream/loopDetector.test.js` that replays `tests/fixtures/loop-reasoning.md` through `createSegmentLoopDetector` and asserts `loopDetected` is true, plus a negative test ensuring distinct sentences are not flagged; verify the loopDetector tests pass

## 3. Verification

- [ ] 3.1 Run `npm run test` and `npm run coverage` and verify all tests pass with no regressions
- [ ] 3.2 Run `npm run lint` and verify lint and formatting pass

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
