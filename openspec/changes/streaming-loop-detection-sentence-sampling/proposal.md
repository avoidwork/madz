## Why

The agent can get stuck in repetitive loops — re-checking status, re-running the same commands, or repeating the same phrasing across multiple responses. This wastes time, creates noise, and can lead to catastrophic decisions (like interrupting a running release). A lightweight, streaming-aware detection mechanism would catch loops early and give the agent a chance to self-correct before things spiral.

## What Changes

- Add a sentence boundary detector that buffers streaming chunks and emits complete sentences on `.`, `!`, or `?`
- Add a sliding window tracker (~30 seconds) that holds recent sentences and tracks their frequency
- Add loop detection logic that triggers when the same sentence appears 3+ times in the window
- Emit a silent "You're looping." nudge message when a loop is detected
- Integrate the sentence sampler into the existing streaming event handler in `src/agent/react.js`
- Follow the existing nudge injection pattern (similar to `RECURSION_LIMIT_MESSAGE`)

## Capabilities

### New Capabilities
- `sentence-sampling`: Real-time sentence extraction from streaming text chunks with boundary detection
- `loop-detection`: Sliding window-based repetition detection with configurable thresholds and silent nudge emission

### Modified Capabilities
<!-- None — no existing spec-level requirements are changing -->

## Impact

- **Affected code:** `src/agent/react.js` (streaming event handler integration), `src/tui/messages.js` (nudge message handling)
- **New files:** `src/agent/sentence-detector.js` (sentence boundary detection), `src/agent/sentence-window.js` (sliding window tracker)
- **Dependencies:** None — pure JavaScript implementation, no external dependencies
- **Systems:** Streaming pipeline, TUI message dispatch