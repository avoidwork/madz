# Tasks

## 1. Tool-Call Loop Check

- [x] 1.1 Add a pure `hasRepeatedToolCall` function in `src/stream/loopCheck.js` that flags a loop when the same tool name + same target recurs more than the configured threshold times with no state change between calls, and verify the new unit tests in `tests/unit/stream/loopCheck.test.js` pass
- [x] 1.2 Wire `hasRepeatedToolCall` into `checkLoop` so a task carrying tool-call records is evaluated, and verify the existing loopCheck tests still pass

## 2. Loop Detector API

- [x] 2.1 Extend `createSegmentLoopDetector` in `src/stream/loopDetector.js` with a `pushTool(name, target, id)` method that records tool-call metadata per stream and triggers a worker check, and verify the new unit tests in `tests/unit/stream/loopDetector.test.js` pass
- [x] 2.2 Ensure `pushTool` validates tool-call metadata (tool name, target) as untrusted input before evaluation, and verify the validation unit tests pass

## 3. Worker Wiring

- [x] 3.1 Update `src/stream/loopDetectorWorker.js` to accept tool-call metadata in the task and run the new check off the main thread, and verify the worker unit tests pass

## 4. Consumer Integration

- [x] 4.1 Route tool-call metadata from `src/stream/consume.js` (lines 242-261, `mode === "tools"` branch) into the loop detector via `pushTool`, not just `streamingCallback`, and verify the integration test in `tests/unit/stream/consume.test.js` passes

## 5. Configuration

- [x] 5.1 Add tool-call gating config fields (enable flag and repeat threshold) to `src/config/schemas/loopDetection.js`, and verify the schema unit tests pass
- [x] 5.2 Add the corresponding tool-call gating settings to the `loopDetection` block in `config.yaml`, and verify the config loads without validation errors

## 6. Verification

- [x] 6.1 Run `npm run test`, `npm run lint`, and `npm run coverage` and confirm no regressions

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
