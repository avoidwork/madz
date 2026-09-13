## Context

The TUI streams assistant responses as a sequence of `message` and `reasoning` segments. `src/tui/messageList.js` `updateMessage` coalesces them into ordered segments per message bubble. The current rule is purely type-based: append if the last segment has the same type, otherwise push a new segment. This fragments continuous sentences when reasoning interleaves mid-sentence and merges unrelated messages that follow reasoning.

The desired behavior (documented in `docs/STREAMING.md`) adds a punctuation check and a timing threshold so continuations are appended only when they plausibly belong to the same sentence. The `250ms` timeout is provisional — chosen from a simulation of synthetic gap distributions (continuations ~80ms, new blocks ~650ms). The ranking of the rules is robust, but the optimal timeout is sensitive to the real gap distribution, so instrumentation must log actual gaps.

## Goals / Non-Goals

**Goals:**
- Implement the Desired Behavior table from `docs/STREAMING.md` in the coalescing logic.
- Capture a per-segment arrival timestamp so cross-type transitions can be gated on timing.
- Make the coalescing decision pure and unit-testable.
- Instrument the live stream to log real inter-segment gaps so the provisional threshold can be tuned.

**Non-Goals:**
- No changes to rendering in `src/tui/messageBubble.js` — it already maps segments in order.
- No changes to upstream event emission.
- No change to the provisional 250ms threshold value (it remains tunable via a named constant).

## Decisions

### Decision 1: Extract a pure `coalesceSegments` helper

The coalescing decision is extracted into an exported pure function `coalesceSegments(existingSegments, newSegment, timeoutMs)` that returns `{ segments, gap }`. This keeps `updateMessage` focused on state mutation and makes the logic directly unit-testable without simulating the React component.

**Alternatives considered:**
- Inline the logic in `updateMessage` — rejected because it is not directly testable and mixes decision logic with state mutation.
- Keep the logic in the component and test via the imperative API simulation — rejected because the simulation in the test file would need to duplicate the logic, risking drift.

### Decision 2: Store timestamp on the segment

Each segment is `{type, content, time}` where `time` is the `Date.now()` value captured at event arrival. Storing it on the segment (rather than a separate ref) survives re-renders and keeps the data model self-contained. The `time` field is optional so existing code that constructs segments without it still works.

**Alternatives considered:**
- Track a `lastSegmentTimeRef` per message — rejected because it is not self-contained and would need to be threaded through `updateMessage` separately.

### Decision 3: Punctuation check only on the message anchor

The punctuation check (`.`, `!`, `?`) applies only to the `reasoning → message` transition, where the last message segment is the anchor. Reasoning segments are not sentence-boundary candidates, so no punctuation check is applied to them. This matches the Desired Behavior table.

### Decision 4: Instrumentation via structured logger

Cross-type transitions log the measured gap via `logger.debug` from `src/shared/logger.js`. No `console.log` is introduced (forbidden per AGENTS.md §1.1). The logger already swallows errors defensively, so instrumentation cannot crash the stream handler.

## Risks / Trade-offs

- [Provisional 250ms threshold may be wrong for real data] → Instrumentation logs actual gaps; the threshold is a named constant `SEGMENT_COALESCE_TIMEOUT_MS` that can be tuned without code restructuring.
- [Timestamp granularity of `Date.now()`] → `Date.now()` is sufficient for gap measurement at the 80ms/650ms scale; no need for `performance.now()`.
- [Existing segments without `time`] → The `time` field is optional; when absent, the timing gate is treated as "within timeout" (append) to preserve backward compatibility for non-streaming/session-restored messages.
