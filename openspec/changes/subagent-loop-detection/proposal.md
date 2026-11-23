# Proposal

## Why

madz already detects reasoning loops in the main agent loop via `createSegmentLoopDetector()` in `src/stream/loopDetector.js`, but this detection is not applied to subagent reasoning. In `src/stream/consume.js` `drainStream`, every `loopDetector.push(...)` call is guarded by `if (!isSubagent)`, so subagent reasoning is forwarded to the TUI as `subagent_reasoning` but never fed to the detector. A subagent (e.g., the code-review subagent) can therefore spin in a reasoning loop indefinitely without being detected or interrupted, wasting tokens and requiring manual cancellation.

## What Changes

- Feed subagent reasoning deltas into the loop detector in `src/stream/consume.js`, for both the `additional_kwargs.reasoning_content` path and the Responses-API content-block `reasoning` path.
- Key subagent reasoning per subagent using the stable `tools:<id>` namespace segment as the detector stream id, so concurrent subagents do not mix in one detector state.
- Manage the subagent turn lifecycle: close a subagent's reasoning turn and release its detector state when the subagent turn ends, mirroring the main-loop behavior.
- Add a `subagent` boolean config knob to `LoopDetectionSchema` (default `true`) that toggles subagent loop detection, wired through `index.js` `runAgent` into `consumeStream`, and added to `config.yaml`.
- Surface a detected subagent loop through the existing `loopDetected` signal so the TUI's silent-nudge / break path handles it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `streaming-loop-detection`: The loop-detection capability gains the requirement that subagent reasoning streams are also monitored for loops, keyed per subagent, with a configurable toggle.

## Impact

- `src/stream/consume.js` — relax subagent guards, key subagent reasoning per subagent, manage subagent turn lifecycle.
- `src/config/schemas/loopDetection.js` — add `subagent` boolean field (default `true`).
- `index.js` — wire `config.loopDetection.subagent` into `consumeStream`.
- `config.yaml` — add `subagent: true` under `loopDetection`.
- `tests/unit/stream/loopDetectorMessageEnd.test.js` / `loopDetectorTurnEnd.test.js` — add subagent-namespace cases.
- `tests/unit/stream/loopDetectorWindow.test.js` — add config-schema test for the `subagent` flag.

## Non-goals

- No new npm dependencies (reuses existing detection primitives).
- No changes to the main-loop detection behavior.
- No new event types beyond the existing `loopDetected` signal.
