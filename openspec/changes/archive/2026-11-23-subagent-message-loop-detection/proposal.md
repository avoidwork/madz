# Proposal

## Why

Streaming loop detection currently covers the orchestrator's own message and reasoning streams and subagent **reasoning** streams, but not subagent **message** text. In `src/stream/consume.js` `drainStream`, the `if (!isSubagent)` guard around `loopDetector.push("message", text, blockIndex)` means a subagent that repeats the same message text without making progress is never detected. This closes that gap so subagent message loops are caught and the stream abandoned, matching the existing subagent reasoning behavior.

## What Changes

- Feed subagent message text to the loop detector in `drainStream`, keyed by the same per-subagent id used for reasoning (`subagentId(namespace)`, the `tools:<id>` segment) so concurrent subagents never share detector state.
- Gate subagent message detection by the same `loopDetection.subagent` toggle (default `true`) that already gates subagent reasoning.
- Keep subagent message text out of the orchestrator's `content` accumulator (unchanged behavior).
- Extend the existing loop-detector tests to cover subagent message loop detection.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `streaming-loop-detection`: Add a requirement that loop detection applies to subagent **message** streams in addition to subagent reasoning, keyed per subagent and gated by the `loopDetection.subagent` toggle.

## Impact

- `src/stream/consume.js` — `drainStream` message-text branch adds an `else if (includeSubagent)` push to the loop detector.
- `src/config/schemas/loopDetection.js` — no schema change; the `subagent` field already exists and is already threaded through `index.js`.
- `index.js` — no change; already passes `subagent: loopConfig.subagent !== false`.
- `tests/unit/stream/loopDetectorMessageEnd.test.js`, `tests/unit/stream/loopDetector.test.js`, `tests/unit/stream/loopDetectorStreams.test.js` — extended with subagent message loop-detection cases.

## Non-goals

- No change to the loop detector's core algorithm, worker, or windowing.
- No change to how subagent output is routed to the subagent store.
- No change to the orchestrator's own message-end detection.
