# Design

## Context

See proposal.md - Why. The streaming loop detector in `src/stream/loopCheck.js` is a pure
module (no I/O) shared by the worker thread and the unit tests. It currently detects loops
via `hasDuplicateSentence` (byte-identical sentence match) and `hasRepeatedWords`
(back-to-back word run). Both are exact-match checks, so garbled repetition — the same
paragraph with corrupted characters on each pass — never collides and the detector never
fires.

## Goals / Non-Goals

**Goals:** Add fuzzy/normalized sentence matching so garbled repetition is flagged as a
loop; keep the existing exact-match and word-run checks as a fast path; make the similarity
threshold configurable.

**Non-Goals:** No change to stream splitting, windowing, TTL, or escalation behavior. No
change to the word-run logic beyond keeping it as a fast path. No change to the TUI
nudge/compaction flow.

## Decisions

### Normalization + token-overlap similarity

Add `normalize(sentence)` that lowercases, strips punctuation, and collapses whitespace,
producing a canonical token string. Add `similarity(a, b)` computing Jaccard similarity over
the normalized token sets, returning a value in [0,1].

**Alternative considered:** Levenshtein/edit-distance on the raw string. Rejected because
character corruption (insertions, deletions, substitutions) is exactly what edit distance
measures, but token-overlap is more robust to word-level corruption and is cheaper to
compute over a window of sentences. Jaccard over normalized tokens is a good fit for the
"same content, garbled characters" pattern.

### `hasSimilarSentence` as an additional branch

Add `hasSimilarSentence(sentences, threshold, similarityThreshold)` that flags when a
sentence has normalized token overlap >= similarityThreshold with another sentence appearing
more than `threshold` times in the window. Wire it into `checkLoop` as an additional branch
(`hasDuplicateSentence || hasRepeatedWords || hasSimilarSentence`), keeping the exact-match
and word-run checks as a fast path so clean loops are still caught cheaply and the added
cost is only paid when exact matching fails.

### Thread the threshold through

`createSegmentLoopDetector` in `src/stream/loopDetector.js` reads a new `similarityThreshold`
option (default 0.85) and includes it in the task payload built in `startCheck`.
`src/stream/loopDetectorWorker.js` forwards the task straight to `checkLoop`, so no logic
change is needed there beyond the task shape.

### Configurable via schema

Add `similarityThreshold` to `LoopDetectionSchema` in `src/config/schemas/loopDetection.js`
(default 0.85). The schema is `.strict()`, so the field must be added or config validation
rejects it.

## Risks / Trade-offs

- [False positives on genuinely distinct sentences] → Use a high default threshold (0.85)
  and add a negative regression test asserting distinct sentences are not flagged.
- [The garbled fixture contains truncated fragments and repeated sub-phrases] → The fuzzy
  check operates on the windowed last-20 sentences, matching existing windowing behavior;
  the regression test replays the fixture through `createSegmentLoopDetector` with
  production `windowSize: 20`, `threshold: 2`.
- [Worker task shape changes] → The worker forwards the task to `checkLoop` unchanged; the
  added `similarityThreshold` field is passed through.

## Migration Plan

No data migration. The change is additive: a new config field with a production-safe default
(0.85) and a new fuzzy check branch. Rollback is a revert of the change.

## Open Questions

None.
