# Design

## Context

See proposal.md - Why. The loop detector in `src/stream/loopCheck.js` only matches byte-identical sentences. The captured garbled loop (`tests/fixtures/loop-reasoning.md`) repeats the same paragraph with corrupted characters each pass, so no two sentences are byte-identical and the detector never fires. The fix adds normalized similarity matching as an additional branch in `checkLoop`, keeping the existing exact-match and word-run checks as a fast path.

## Goals / Non-Goals

**Goals:**
- Detect garbled (non-byte-identical) repetition of the same content via normalized token-overlap similarity.
- Keep the existing exact-match and word-run checks as a fast path.
- Make the similarity threshold configurable via the `loopDetection` schema (default 0.85).
- Add regression tests replaying the captured garbled loop and asserting `loopDetected` is true, plus tests ensuring distinct sentences are not false-flagged.

**Non-Goals:**
- Changing the windowing, TTL, or escalation behavior.
- Altering the worker threading model or the streaming pipeline integration.
- Adding a new capability spec; the behavior belongs to the existing `streaming-loop-detection` capability.

## Decisions

**Decision 1: Normalize then compare by token overlap (Jaccard).**
Add `normalize(sentence)` that lowercases, strips punctuation, and collapses whitespace, and `similarity(a, b)` computing Jaccard overlap of the normalized token sets. This catches garbled variants where most words survive but characters are corrupted. Alternatives considered: Levenshtein/edit distance (heavier, less robust to word-order shuffling) and exact-match only (the current behavior, which fails). Jaccard on token sets is simple, bounded, and robust to the corruption pattern in the fixture.

**Decision 2: Add `hasSimilarSentence` as an additional branch in `checkLoop`.**
`checkLoop` becomes `hasDuplicateSentence(...) || hasRepeatedWords(...) || hasSimilarSentence(...)`. The exact-match and word-run checks remain as a fast path, so clean loops are still caught cheaply and the fuzzy check only runs when the fast path misses. This preserves backward compatibility with existing tests.

**Decision 3: Thread `similarityThreshold` through the detector and schema.**
Add a `similarityThreshold` option (default 0.85) to `createSegmentLoopDetector`, include it in the task payload built in `startCheck`, and add it to `LoopDetectionSchema`. The worker forwards the task unchanged, so no logic change is needed there. This makes the threshold tunable without code changes.

## Risks / Trade-offs

- [False positives on distinct-but-similar sentences] → The default threshold of 0.85 requires high token overlap; regression tests assert distinct sentences are not flagged.
- [Performance of O(n²) pairwise comparison within the window] → The window is bounded to `windowSize` (default 20) sentences, so the cost is small and bounded.
- [Backward compatibility with existing configs] → The new schema field has a default, so existing configs parse unchanged.
