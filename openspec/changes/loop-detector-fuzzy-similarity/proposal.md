# Proposal

## Why

The streaming loop detector only matches byte-identical sentences. When a model emits the same paragraph repeatedly with corrupted characters introduced on each pass (garbled repetition), no two sentences are byte-identical and the detector never fires, so the loop runs unchecked. This change makes the detector catch garbled repeats while keeping exact-match detection as a fast path.

## What Changes

- Add fuzzy/normalized sentence matching to the loop check: a `normalize()` helper (lowercase, strip punctuation, collapse whitespace) and a token-overlap/Jaccard `similarity()` function.
- Add `hasSimilarSentence()` that flags a sentence when its normalized token overlap with another sentence exceeds a configurable `similarityThreshold` and it appears more than `threshold` times.
- Wire the fuzzy check into `checkLoop` as an additional branch, keeping the existing exact-match and word-run checks as a fast path.
- Add a configurable `similarityThreshold` (default 0.85) threaded through `createSegmentLoopDetector`, the worker task payload, and `LoopDetectionSchema`.
- Add regression tests replaying the captured garbled loop (`tests/fixtures/loop-reasoning.md`) and asserting `loopDetected` is true, plus tests ensuring normal distinct sentences are not false-flagged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `streaming-loop-detection`: Add a requirement that the loop detector flags garbled (non-byte-identical) repetition of the same content via normalized similarity matching, with a configurable similarity threshold.

## Impact

- `src/stream/loopCheck.js` — new `normalize`, `similarity`, `hasSimilarSentence`; `checkLoop` gains a fuzzy branch.
- `src/stream/loopDetector.js` — `createSegmentLoopDetector` gains a `similarityThreshold` option; `startCheck` includes it in the task payload.
- `src/stream/loopDetectorWorker.js` — task shape carries the threshold (no logic change).
- `src/config/schemas/loopDetection.js` — `LoopDetectionSchema` gains `similarityThreshold` (default 0.85).
- `tests/unit/stream/loopCheck.test.js`, `tests/unit/stream/loopDetector.test.js` — new tests.
- No auth, input handling, or file I/O is touched; the fix operates purely on in-memory sentence comparison.

## Non-goals

- Not changing the exact-match or word-run fast paths.
- Not altering the windowing, TTL, or escalation behavior.
- Not adding a new capability spec; the behavior belongs to the existing `streaming-loop-detection` capability.
