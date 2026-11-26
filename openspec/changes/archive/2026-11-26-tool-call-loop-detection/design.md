# Design

## Context

See proposal.md - Why. The loop detector (`src/stream/loopDetector.js` -> `createSegmentLoopDetector`) currently exposes only `push(kind, delta, id)` for streamed text deltas. `src/stream/loopCheck.js` (`checkLoop` / `hasRepeatedChain` / `hasRepeatedRun`) operates purely on word arrays. The consumer in `src/stream/consume.js` (lines 242-261) already receives `on_tool_start` / `on_tool_end` payloads carrying `payload.name`, `payload.input`, and `payload.output` in the `mode === "tools"` branch, but forwards them only to `streamingCallback`. The worker in `src/stream/loopDetectorWorker.js` carries only `words`, `threshold`, `minChain`, `maxChain`, `maxRun`.

## Goals / Non-Goals

**Goals:**
- Add a pure tool-call loop check that flags repeated identical tool calls (same name + same target) with no intervening state change.
- Extend the loop detector API with a `pushTool(name, target, id)` method.
- Route tool-call metadata from the consumer into the loop detector.
- Wire the worker thread to evaluate tool-call metadata off the main thread.
- Add configurable enable flag and repeat threshold for tool-call gating.

**Non-Goals:**
- Changing the existing word-chain text detector.
- Adding any new npm dependency.

## Decisions

**Decision: Keep the tool-call check pure and free of I/O.**
The existing word-chain logic lives in `loopCheck.js` as pure functions so the worker thread and unit tests run the exact same code. The tool-call check follows the same pattern: a pure function (e.g. `hasRepeatedToolCall`) that operates on a list of tool-call records, so it can be unit-tested directly and run in the worker.

**Decision: Track tool-call metadata per stream, keyed like the text detector.**
`createSegmentLoopDetector` keys state by `kind` plus `id`. Tool-call metadata is routed into the same per-stream state so concurrent streams never mix, consistent with the existing design. The `pushTool(name, target, id)` method records a tool-call record into the stream's state and triggers a worker check.

**Decision: A "state change" is defined by the tool-call record differing between calls.**
A loop is flagged when the same tool name + same target recurs more than the configured repeat threshold times with no state change between calls. An intervening call to a different target, or a call whose target differs, constitutes a state change and resets the run. This mirrors the existing threshold semantics.

**Decision: Add config fields to `LoopDetectionSchema` and `config.yaml`.**
Add an enable flag (e.g. `toolCallsEnabled`) and a repeat threshold (e.g. `toolCallThreshold`) to `src/config/schemas/loopDetection.js` and the `loopDetection` block in `config.yaml`. When the enable flag is false, tool-call metadata is not evaluated.

**Alternatives considered:**
- Extending the existing word-chain text detector to also consider tool calls. Rejected because the text detector only sees streamed text and cannot observe tool-call metadata; a separate mechanism is required for this distinct signal.

## Risks / Trade-offs

- [Tool-call metadata may be malformed] → Validate tool name, target, and argument before feeding to the loop detector; treat as untrusted input.
- [False positives from legitimate repeated tool calls] → Gate behind a configurable enable flag and repeat threshold; a state change between calls resets the run.
- [Worker thread overhead] → The check is small and stateless, consistent with the existing pool; the pool is capped at `maxThreads`.
