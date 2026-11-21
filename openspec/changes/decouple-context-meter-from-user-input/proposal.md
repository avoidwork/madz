# Proposal

## Why

The TUI context meter in the status bar reacts to user input. It recomputes on user submit (adding the just-typed HumanMessage) and estimates content tokens live during streaming, so the displayed context utilization is influenced by the user's typed/submitted input rather than reflecting only the state reported by the provider. This makes the meter misleading and couples it to input the provider has not yet seen.

## What Changes

- Source the context meter from the provider-reported input token count (the latest real model call) instead of a local tokenizer estimate.
- Stop recomputing the meter on user submit in `handleChat` (src/tui/conversationArea.js), so typing/submitting no longer moves the meter.
- Hold the meter at the last provider-reported value during streaming instead of estimating content tokens live.
- Update the meter from the provider-reported input tokens when a real model call completes.
- Expose the provider-reported input token count from `src/provider/contextCalibration.js` so the TUI can read the last reported value.
- Add tests covering the provider-driven meter and the no-user-input coupling.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tui-context-meter`: The meter SHALL be driven by provider-reported input tokens rather than a local tokenizer estimate, and SHALL NOT react to user typed/submitted input.
- `context-estimation`: The meter no longer recomputes from the model tokenizer on user submit; it reflects the provider-reported value.

## Impact

- `src/tui/conversationArea.js` — updateContextSize, handleChat, debouncedContextUpdate, preStreamContextSize, toolMessageTokensRef
- `src/tui/app.js` — onContextChange, contextWindow
- `src/tui/inputArea.js` — setContextSize, StatusBar props
- `src/tui/statusBar.js` — meter rendering
- `src/provider/contextCalibration.js` — expose provider-reported input token count
- Tests: `tests/unit/tui/conversationArea.test.js`, `tests/unit/provider/contextCalibration.test.js`

## Non-goals

- No changes to the status bar layout or styling.
- No changes to the calibration overhead derivation math.
- No changes to the tokenizer itself.
