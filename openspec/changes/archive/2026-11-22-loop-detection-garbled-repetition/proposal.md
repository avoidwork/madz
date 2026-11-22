# Proposal

## Why

The streaming loop detector only catches byte-identical sentence repetition. When a model
emits the same paragraph repeatedly but with corrupted characters on each pass (garbled
repetition), no two sentences are byte-identical, so the detector never fires and the loop
runs on. This change makes the detector flag garbled repetition as a loop.

## What Changes

- Add a `normalize(sentence)` helper that lowercases, strips punctuation, and collapses
  whitespace.
- Add a token-overlap (Jaccard) `similarity(a, b)` function returning a value in [0,1].
- Add `hasSimilarSentence(sentences, threshold, similarityThreshold)` that flags when a
  sentence has normalized token overlap >= similarityThreshold with another sentence
  appearing more than `threshold` times in the window.
- Wire `hasSimilarSentence` into `checkLoop` as an additional branch, keeping the existing
  exact-match and word-run checks as a fast path.
- Thread a configurable `similarityThreshold` (default 0.85) through
  `createSegmentLoopDetector`, the worker task payload, and the `LoopDetectionSchema`.
- Add regression tests replaying the captured garbled loop fixture and negative tests for
  distinct sentences.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `streaming-loop-detection`: add a requirement that the streaming loop detector flags
  garbled repetition (near-duplicate sentences with corrupted characters) as a loop, using
  normalized token-overlap similarity above a configurable threshold, in addition to the
  existing exact-match and word-run checks.

## Impact

- `src/stream/loopCheck.js` — add `normalize`, `similarity`, `hasSimilarSentence`; extend
  `checkLoop`.
- `src/stream/loopDetector.js` — add `similarityThreshold` option; extend `startCheck` task.
- `src/stream/loopDetectorWorker.js` — task shape passes through.
- `src/config/schemas/loopDetection.js` — add `similarityThreshold` field (default 0.85).
- `tests/unit/stream/loopCheck.test.js`, `tests/unit/stream/loopDetector.test.js` — new
  regression and negative tests.
- `tests/fixtures/loop-reasoning.md` — existing fixture replayed in a regression test.

## Non-goals

- No change to the word-run (`hasRepeatedWords`) logic beyond keeping it as a fast path.
- No change to stream splitting, windowing, TTL, or escalation behavior.
- No change to the TUI nudge/compaction flow.
