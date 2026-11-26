# Proposal

## Why

The loop detector today only observes streamed text (word chains and repeated runs). It cannot see tool-call metadata, so a subagent that repeatedly calls the same tool against the same target with no state change between calls is not detected as looping. This is a distinct signal from streamed text and requires its own detection path.

## What Changes

- Add a new tool-call loop check that flags a loop when the same tool name + same target recurs with no state change between calls.
- Extend the loop detector API with a `pushTool(name, target, id)` method that records tool-call metadata per stream.
- Route tool-call metadata from the stream consumer (`src/stream/consume.js`, `mode === "tools"` branch) into the loop detector, not just `streamingCallback`.
- Wire the worker thread to accept and evaluate tool-call metadata off the main thread.
- Add configuration (an enable flag and a repeat threshold) for tool-call gating in `src/config/schemas/loopDetection.js` and `config.yaml`.
- Add unit and integration tests covering repeated identical tool calls, calls with an intervening state change, calls to different targets, a single call, and calls interleaved with streamed text.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `streaming-loop-detection`: Add a requirement that the system SHALL flag a loop when the same tool is called repeatedly against the same target (same tool name + same target/argument) with no state change between calls, distinct from the word-chain text detector.

## Impact

- `src/stream/loopDetector.js` — extend `createSegmentLoopDetector` with a `pushTool` method.
- `src/stream/loopCheck.js` — add a pure tool-call loop check.
- `src/stream/loopDetectorWorker.js` — accept tool-call metadata in the task.
- `src/stream/consume.js` — route tool-call metadata into the loop detector.
- `src/config/schemas/loopDetection.js` and `config.yaml` — add tool-call gating config.
- `tests/unit/stream/` — new tests for the tool-call path.
- No new npm packages expected.

## Non-goals

- Changing the existing word-chain text detector (already addressed by raising `minChain` from 3 to 5).
- Adding any new npm dependency.
