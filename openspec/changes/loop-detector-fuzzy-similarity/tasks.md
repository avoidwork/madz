# Tasks

## 1. Fuzzy Matching in loopCheck

- [ ] 1.1 Add `normalize(sentence)` and `similarity(a, b)` helpers to `src/stream/loopCheck.js` and verify unit tests cover normalization and Jaccard similarity
- [ ] 1.2 Add `hasSimilarSentence(sentences, threshold, similarityThreshold)` to `src/stream/loopCheck.js` and verify unit tests cover garbled-repeat detection and non-false-flagging of distinct sentences
- [ ] 1.3 Wire `hasSimilarSentence` into `checkLoop` as an additional branch, keeping the exact-match and word-run fast paths, and verify existing `checkLoop` tests still pass

## 2. Thread the Threshold Through

- [ ] 2.1 Add `similarityThreshold` option (default 0.85) to `createSegmentLoopDetector` in `src/stream/loopDetector.js` and include it in the task payload in `startCheck`, and verify the detector test passes
- [ ] 2.2 Add `similarityThreshold` (default 0.85) to `LoopDetectionSchema` in `src/config/schemas/loopDetection.js` and verify the schema test passes

## 3. Regression Tests

- [ ] 3.1 Add a regression test in `tests/unit/stream/loopDetector.test.js` replaying `tests/fixtures/loop-reasoning.md` through `createSegmentLoopDetector` and asserting `loopDetected` is true, and verify it passes
- [ ] 3.2 Add unit tests in `tests/unit/stream/loopCheck.test.js` for the new fuzzy functions and verify they pass
- [ ] 3.3 Run `npm run test` and `npm run coverage` and verify no regressions

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
