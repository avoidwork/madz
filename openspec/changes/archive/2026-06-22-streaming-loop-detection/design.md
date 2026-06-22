## Context

The madz agent streams responses through `callReactAgentStreaming()` in `src/agent/react.js`, where chunks arrive via `on_chat_model_stream` events. Currently, there is no mechanism to detect when the agent is stuck in a repetitive loop — re-checking status, re-running the same commands, or repeating the same phrasing. The existing `RECURSION_LIMIT_MESSAGE` pattern (react.js line 53) provides a "Please continue." nudge but doesn't address textual repetition during streaming.

The TUI already distinguishes between streaming and non-streaming messages (`src/tui/messages.js`), and has infrastructure for handling special message types. This feature builds on that foundation.

## Goals / Non-Goals

**Goals:**
- Detect sentence-level repetition in active streaming messages in real-time
- Maintain a 30-second sliding window of recent sentences with frequency tracking
- Emit a silent "You're looping." nudge when repetition exceeds threshold (>3 occurrences)
- Integrate seamlessly into the existing streaming pipeline without modifying chunk data
- Handle streaming edge cases: partial chunks, sentence boundary detection, stream cleanup

**Non-Goals:**
- Full conversation history analysis (only active streaming message)
- Cross-message loop detection
- User-visible notifications (nudge is silent, agent-facing only)
- Stream interruption or agent behavior modification beyond the nudge
- Long-term pattern learning or adaptive thresholds

## Decisions

### 1. Sentence-level detection over substring matching
**Decision:** Use sentence boundary detection (`.`, `!`, `?`) rather than random substring sampling.
**Rationale:** Sentence-level detection captures meaningful repetition rather than fragile character-level matches. Random substring sampling (10-50 chars) is too fragile and prone to false positives on common phrases. Full response comparison is too heavy and doesn't work well with streaming.
**Alternatives considered:**
- Random substring sampling — rejected as too fragile
- Full response comparison — rejected as too heavy, high false positive rate
- Tool call tracking — rejected as it misses textual repetition (the more common case)

### 2. Sliding window over fixed buffer
**Decision:** Use a time-based sliding window (30 seconds) that releases old sentences and accepts new ones.
**Rationale:** A sliding window is lightweight and focused on the active streaming context. It naturally handles the streaming scenario where repetition is most likely to be caught early. A fixed buffer would either miss longer loops or require unbounded memory.
**Alternatives considered:**
- Fixed-size buffer — rejected as it doesn't account for time-based repetition patterns
- Full history tracking — rejected as computationally expensive and not streaming-aware

### 3. Silent nudge over stream interruption
**Decision:** Emit a silent "You're looping." nudge that the agent receives but doesn't interrupt the stream.
**Rationale:** The nudge gives the agent agency to self-correct without the risk of breaking valid repetitive patterns (e.g., status checks that legitimately repeat). This follows the existing `RECURSION_LIMIT_MESSAGE` pattern and is less aggressive than forcibly interrupting the stream.
**Alternatives considered:**
- Stream interruption — rejected as too aggressive, risks breaking valid patterns
- User-visible notification — rejected as the nudge is agent-facing, not user-facing

### 4. Per-stream sampler state
**Decision:** The sentence sampler maintains state per-stream, resetting on stream end.
**Rationale:** This ensures no cross-contamination between concurrent streams and prevents memory leaks from abandoned buffers. Each stream gets its own independent loop detection context.

### 5. Component separation: detector + tracker
**Decision:** Split sentence processing into two components: `SentenceDetector` (boundary detection) and `SlidingWindowTracker` (frequency tracking).
**Rationale:** Separation of concerns makes each component testable in isolation. The detector handles the messy reality of streaming chunks (partial sentences, buffering), while the tracker handles the logic of window management and frequency analysis. This also makes it easier to swap out one component without affecting the other.

## Risks / Trade-offs

### Risk: False positives on naturally repetitive phrasing
**Mitigation:** The 30-second window and >3 occurrence threshold provide reasonable guardrails. If false positives become a problem, the threshold or window size can be adjusted. The silent nudge approach means even false positives are low-impact — they just give the agent a chance to self-correct.

### Risk: Sentence boundary edge cases
**Mitigation:** The sentence detector must handle edge cases like `Mr. Smith`, `e.g.`, `...`, `?!`. We'll implement a simple heuristic: only treat `.`, `!`, `?` as boundaries when followed by whitespace or end-of-stream. This handles most cases without requiring a full NLP parser.

### Risk: Performance overhead
**Mitigation:** The sentence detector and tracker are lightweight — simple string buffering and frequency counting. The 30-second window means we're only tracking a small number of sentences at any time. Performance impact should be negligible.

### Risk: Memory leaks from unbounded buffers
**Mitigation:** Per-stream state ensures buffers are cleaned up when streams end. The sliding window automatically releases old sentences. We'll add explicit cleanup on stream abort/cancel.

## Migration Plan

This is a new feature with no migration required. The changes are additive:
1. Add new files: `src/agent/sentence-detector.js`, `src/agent/sliding-window-tracker.js`
2. Modify existing files: `src/agent/react.js` (integration), `src/tui/messages.js` (nudge handling)
3. No database changes, no API changes, no configuration changes

Rollback is straightforward — revert the changes to `react.js` and `messages.js`, remove the new files.

## Open Questions

1. **Should the threshold be configurable?** Currently hardcoded at >3 occurrences. Could be made configurable via environment variable or config file if needed in the future.
2. **Should we debounce rapid successive loops?** If the agent loops multiple times in quick succession, should we suppress subsequent nudges? This could be added as a future enhancement.
3. **Should we track sentence similarity (fuzzy matching) or exact match?** Currently planned as exact match (after normalization). Fuzzy matching would catch paraphrased loops but adds complexity and potential false positives.