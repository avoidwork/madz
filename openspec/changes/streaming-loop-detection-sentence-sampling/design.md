## Context

The agent's streaming pipeline (`src/agent/react.js`) processes text chunks from the LLM in real-time via `on_chat_model_stream` events. Currently, there is no mechanism to detect when the agent is stuck in a repetitive loop — re-checking status, re-running the same commands, or repeating the same phrasing across multiple responses. This can waste time, create noise, and lead to poor decisions.

The existing nudge pattern (`RECURSION_LIMIT_MESSAGE` in `src/agent/react.js`) provides a template for injecting non-disruptive messages into the streaming flow. The TUI (`src/tui/messages.js`) already distinguishes between streaming and non-streaming messages, making it suitable for handling a silent loop detection nudge.

## Goals / Non-Goals

**Goals:**
- Detect textual repetition in the active streaming message in real-time
- Implement a sentence boundary detector that handles streaming chunks gracefully
- Maintain a sliding window of recent sentences with frequency tracking
- Emit a silent "You're looping." nudge when repetition exceeds threshold
- Integrate cleanly into the existing streaming pipeline without major refactoring

**Non-Goals:**
- Full conversation history analysis (only the active streaming message is tracked)
- Behavioral loop detection via tool call tracking (out of scope for this change)
- Complex NLP sentence tokenization (simple punctuation-based detection is sufficient)
- User-facing loop detection UI (the nudge is silent and agent-only)

## Decisions

### Decision 1: Punctuation-based sentence boundary detection
**Choice:** Detect sentence boundaries on `.`, `!`, or `?` rather than using NLP tokenization.
**Rationale:** The use case is lightweight real-time detection during streaming. NLP tokenization would add external dependencies and complexity without meaningful benefit for detecting repetition. Simple punctuation detection is sufficient for the target patterns (repeated phrases, status checks, command re-runs).
**Alternatives considered:** spaCy or natural.js for sentence tokenization — rejected due to external dependency overhead and streaming complexity.

### Decision 2: Time-based sliding window (30 seconds)
**Choice:** Maintain a 30-second sliding window of recent sentences with timestamp-based expiration.
**Rationale:** 30 seconds balances sensitivity (catching loops early) with specificity (avoiding false positives on natural phrasing reuse). A sentence that repeats within 30 seconds is likely a loop; repetition across longer gaps may be natural.
**Alternatives considered:** Fixed-count window (e.g., last 10 sentences) — rejected because it doesn't account for streaming speed variability. Time-based window adapts to both fast and slow streaming.

### Decision 3: Threshold of 3 repetitions
**Choice:** Trigger loop detection when the same sentence appears 3+ times in the window.
**Rationale:** Two occurrences could be natural (e.g., "Let me check that" appearing twice in different contexts). Three occurrences is a stronger signal of a loop. This threshold can be tuned later if needed.
**Alternatives considered:** 2 repetitions — rejected as too sensitive, would cause false positives. 4+ repetitions — rejected as too late to be useful.

### Decision 4: Silent nudge injection
**Choice:** Emit a special callback event (`{ type: 'loop_detected' }`) that the TUI converts to a silent "You're looping." nudge, following the existing `RECURSION_LIMIT_MESSAGE` pattern.
**Rationale:** The nudge should be non-disruptive to the user experience while giving the agent a signal to self-correct. The existing nudge pattern is proven and well-integrated.
**Alternatives considered:** User-facing notification — rejected as unnecessary alarm. Hard interrupt — rejected as too disruptive.

### Decision 5: Pure JavaScript implementation
**Choice:** Implement all components in pure JavaScript with no external dependencies.
**Rationale:** Keeps the change lightweight, avoids dependency bloat, and aligns with the existing codebase patterns. The sentence detector and window tracker are simple enough to not require external libraries.

## Risks / Trade-offs

### Risk: False positives on natural phrasing reuse
**Mitigation:** The 3-repetition threshold and 30-second window reduce false positives. Natural phrasing reuse (e.g., "Let me check that") typically doesn't repeat 3 times within 30 seconds. If false positives occur, the threshold or window size can be tuned.

### Risk: Performance impact from sentence sampling
**Mitigation:** The sentence detector and window tracker are lightweight operations (string buffering, map lookups, timestamp comparisons). No heavy computation or external API calls. Performance impact should be negligible.

### Risk: Edge cases in sentence boundary detection
**Mitigation:** Handle ellipses (`...`) by not triggering sentence emission on consecutive periods. Abbreviations (e.g., "Mr.", "Dr.") may cause false boundaries, but this is acceptable — it may slightly reduce detection sensitivity but won't cause crashes or incorrect behavior.

### Risk: Nudge handling by the agent
**Mitigation:** The nudge follows the existing `RECURSION_LIMIT_MESSAGE` pattern, which the agent already handles gracefully as a signal to self-correct. No new agent behavior is required.

## Migration Plan

This change is additive — no existing functionality is modified or removed. The sentence sampler integrates into the existing streaming pipeline without breaking changes. No migration plan is required.

## Open Questions

1. Should the repetition threshold (3) and window size (30 seconds) be configurable via environment variables or config file? This would allow tuning without code changes.
2. Should the nudge message be customizable (e.g., "You're looping." vs. "Repeated pattern detected.")? Currently hardcoded for simplicity.
3. Should we track sentence similarity (fuzzy matching) rather than exact matching? This would catch paraphrased loops but adds complexity. Currently, exact matching is sufficient for the target use cases.