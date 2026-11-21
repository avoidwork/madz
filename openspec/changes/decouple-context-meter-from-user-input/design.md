# Design

## Context

See proposal.md - Why. The context meter is currently computed in `src/tui/conversationArea.js` via `updateContextSize`, which calls `model.getNumTokensFromMessages()` plus a calibrated overhead, and pushes it up through `onContextChange` to `InputArea.setContextSize` to `StatusBar`. The provider-reported `input_tokens` is already read in `src/provider/contextCalibration.js` but is only used to derive an overhead offset, not to drive the meter directly.

## Goals / Non-Goals

**Goals:**
- Drive the meter from the provider-reported input token count from the latest real model call.
- Stop recomputing the meter on user submit.
- Hold the meter at the last provider-reported value during streaming.
- Expose the provider-reported count from `contextCalibration.js` for the TUI to read.

**Non-Goals:**
- No changes to the status bar layout or styling.
- No changes to the calibration overhead derivation math.
- No changes to the tokenizer.

## Decisions

**Decision: Expose the provider-reported input token count from `contextCalibration.js`.**
The module already reads `input_tokens` from each real model call via `readInputTokens`/`setContextOverhead`. We add an accessor that returns the last reported input token count, so the TUI can read it directly. This keeps the calibration math unchanged while making the provider-reported value the single source of truth for the meter.
- *Alternative considered:* Recompute from the tokenizer on each render. Rejected because that is exactly the user-input coupling we are removing.

**Decision: Remove the `updateContextSize` call in `handleChat`.**
The call appends the just-typed HumanMessage and recomputes, which is the direct reaction to user input. Removing it stops typing/submitting from moving the meter.

**Decision: Replace the live-estimate `debouncedContextUpdate` streaming path with hold-at-last-provider-reported-value.**
During an in-flight stream, the meter holds at the last provider-reported value rather than estimating content tokens live. This prevents the meter from jumping based on estimated tokens.

**Decision: Update the meter from the provider-reported value when a real model call completes.**
When a real model call completes, the meter updates from the provider-reported input tokens rather than the local tokenizer estimate.

## Risks / Trade-offs

- [The provider-reported value may not be available until the first real model call completes] → The meter must have a sensible initial state (e.g., 0 or the last known value).
- [Streaming must not cause the meter to jump based on estimated tokens] → Hold at the last provider-reported value during streaming.
- [No regression in the calibration overhead derivation] → Keep the calibration math unchanged; only expose the raw provider-reported count.
