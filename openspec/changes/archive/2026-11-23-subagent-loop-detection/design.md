# Design

## Context

See proposal.md - Why. The existing loop detector `createSegmentLoopDetector()` in `src/stream/loopDetector.js` already tracks a rolling window of completed sentences and words per stream (keyed by kind plus id), flags a loop when repeats exceed `threshold`, and runs checks in a Piscina worker pool. The gap is purely in `src/stream/consume.js` `drainStream`, where every `loopDetector.push(...)` call is guarded by `if (!isSubagent)`, so subagent reasoning is never fed to the detector and subagent turns are never closed.

## Goals / Non-Goals

**Goals:**
- Feed subagent reasoning deltas to the loop detector.
- Key subagent reasoning per subagent so concurrent subagents do not mix.
- Manage the subagent turn lifecycle so detector state is released at turn end.
- Add a configurable toggle for subagent loop detection.
- Surface a detected subagent loop through the existing `loopDetected` signal.

**Non-Goals:**
- No new npm dependencies.
- No change to the main-loop detection behavior.
- No new event types beyond the existing `loopDetected` signal.

## Decisions

**Decision 1: Reuse the existing detector rather than a new primitive.**
The detector already keys state by `kind` plus `id`. Subagent reasoning is a distinct kind of stream that can be fed through the same `push("reasoning", delta, id)` path. No new detection logic is needed. Alternative (a separate subagent detector) rejected as redundant and duplicative.

**Decision 2: Key subagent reasoning by the `tools:<id>` namespace segment.**
`isSubagentNamespace()` in `src/stream/namespace.js` already identifies subagent-scoped namespaces. The stable per-subagent id is the `tools:<id>` segment, which we pass as the `id` argument to `loopDetector.push(...)`. This keeps concurrent subagents in separate detector states. The `maxStreams` cap (default 4) already accommodates the realistic concurrency, so it is not raised. Alternative (a single shared subagent stream) rejected because it would mix concurrent subagents and cause false positives.

**Decision 3: Gate subagent loop detection behind a `subagent` config flag.**
Add a `subagent` boolean to `LoopDetectionSchema` (default `true`), wire it through `index.js` `runAgent` into `consumeStream`. When false, subagent reasoning is not pushed to the detector. This preserves the existing behavior for deployments that want to disable it. Default `true` so the feature is on by default.

**Decision 4: Manage the subagent turn lifecycle in `drainStream`.**
Extend the `endMessage`/`end`/`reset` handling so a subagent's reasoning turn is closed and its detector state released when the subagent turn ends, mirroring the main-loop behavior. This prevents state leaking across turns.

## Risks / Trade-offs

- [Subagent reasoning may be short and repeat legitimately] → The detector's existing `threshold` and `similarityThreshold` already guard against false positives; a subagent that makes progress with a short repeated phrase is not flagged because the detector only flags when repeats exceed the threshold.
- [Concurrent subagents exceed `maxStreams`] → The cap evicts the least recently updated stream; a looping stream is always receiving deltas so it is never evicted. The default of 4 leaves headroom for the realistic case.
- [Config flag default changes behavior] → Default `true` enables the feature; deployments can opt out via `subagent: false`.

## Migration Plan

No migration required. The change is additive and backward-compatible; the new config field defaults to `true`.

## Open Questions

None.
