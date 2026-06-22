## Why

The agent can get stuck in repetitive loops — re-checking status, re-running the same commands, or repeating the same phrasing across multiple responses. This wastes time, creates noise, and can lead to catastrophic decisions (like interrupting a running release). A lightweight, streaming-aware detection mechanism would catch loops early and give the agent a chance to self-correct before things spiral.

## What Changes

- Add a sentence boundary detector that buffers streaming chunks and emits complete sentences when boundaries (`.`, `!`, `?`) are detected
- Add a sliding window tracker that holds sentences for ~30 seconds, tracks frequency, and detects repetition
- When any sentence appears more than 3 times within the window, emit a silent "You're looping." nudge to the agent
- Integrate the sentence sampler into the existing streaming pipeline in `callReactAgentStreaming()`
- The nudge follows the existing `RECURSION_LIMIT_MESSAGE` pattern — silent, non-disruptive, handled by the TUI as a special message type

## Capabilities

### New Capabilities
- `streaming-loop-detection`: Sentence-level sampling from active streaming messages with sliding window frequency tracking and silent loop nudge injection

### Modified Capabilities
<!-- None — this is a new capability, not a modification of existing spec requirements -->

## Impact

- **Affected code:**
  - `src/agent/react.js` — `callReactAgentStreaming()` function (lines 263-400), integration point for sentence sampler
  - `src/tui/messages.js` — Message state tracking, handling of loop_detected nudge type
- **New files:**
  - `src/agent/sentence-detector.js` — Sentence boundary detection component
  - `src/agent/sliding-window-tracker.js` — Sliding window sentence tracking and frequency analysis
- **Dependencies:** None external — uses only existing streaming infrastructure and TUI patterns