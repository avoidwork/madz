## Why

The ESC key in the Madz TUI currently exits the application entirely, which is destructive when the user intends to cancel or interrupt a specific operation (e.g., a long-running LLM stream, file write, or search query). Users need a non-destructive way to back out of operations without losing their session or having to restart the application.

## What Changes

- Modify the ESC key handler in `src/tui/app.js` to interrupt/skip the current operation instead of exiting the application
- During streaming: already calls `handleInterrupt()` — verify and enhance if needed
- During non-streaming operations: replace `handleQuit()` with an interrupt mechanism that clears input, cancels pending operations, and returns to the main prompt
- Add visual feedback (`[interrupted]` or similar) when an operation is cancelled
- Preserve existing ESC behavior during onboarding/profile creation (ESC still exits)
- Preserve existing ESC behavior in panel views (settings, memory — ESC exits panel)

## Capabilities

### New Capabilities
- `tui-esc-interrupt`: Define ESC key behavior for interrupt/skip across all TUI contexts (streaming, non-streaming, onboarding exception, panel exception)

### Modified Capabilities
- `streaming-interruption`: Extend to cover non-streaming interrupt scenarios (file operations, search/query) and add visual feedback requirements

## Impact

- `src/tui/app.js` — Main ESC key handler (lines 841-848)
- `src/tui/inputPanel.js` — Input buffer clearing
- `src/session/stateManager.js` — May need interrupt function for session state preservation
- `openspec/specs/streaming-interruption/spec.md` — Extend spec to cover non-streaming interrupts
- New spec: `openspec/specs/tui-esc-interrupt/spec.md` — Define ESC interrupt behavior

## Non-goals

- Changing ESC behavior during onboarding/profile creation (remains exit)
- Changing ESC behavior in panel views (settings, memory — remains panel exit)
- Adding configurable ESC behavior (could be added later if needed)
- Implementing additional keyboard shortcuts for interrupt (focus on ESC only)