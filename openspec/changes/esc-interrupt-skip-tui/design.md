# Design: ESC Interrupt/Skip in TUI

## Overview

This change modifies the ESC key behavior in the Madz TUI from exiting the application to interrupting or skipping the current operation. The change is focused on the main TUI input handler in `src/tui/app.js` while preserving existing ESC behavior in onboarding and panel contexts.

## Architecture

### Current State

The main ESC handler in `src/tui/app.js` (lines 841-848) uses a conditional:
- When `isStreamingRef.current` is true → calls `handleInterrupt()` (correct behavior)
- When `isStreamingRef.current` is false → calls `handleQuit()` (needs change)

### Proposed State

Replace the non-streaming branch with an interrupt mechanism:
- When `isStreamingRef.current` is true → calls `handleInterrupt()` (unchanged)
- When `isStreamingRef.current` is false → calls `handleInterrupt()` (new behavior)
- Onboarding flow (lines 819-821) → calls `handleQuit()` (unchanged, protected by condition)
- Panel views → calls `handleQuit()` (unchanged, handled by panel-specific logic)

### Implementation Strategy

#### 1. Centralize Interrupt Logic

Create or enhance the `handleInterrupt()` function to handle all interrupt scenarios:

```javascript
function handleInterrupt() {
  // 1. Abort any active stream
  abortControllerRef.current?.abort();
  
  // 2. Clear input buffer
  setInputValue('');
  
  // 3. Set interrupted state for visual feedback
  setInterrupted(true);
  
  // 4. Clean up session state if needed
  // (remove orphaned tool-call messages, clear partial assistant messages)
  
  // 5. Reset streaming flags
  isStreamingRef.current = false;
  abortControllerRef.current = new AbortController();
  
  // 6. Clear interrupted flag after brief delay (for visual feedback)
  setTimeout(() => setInterrupted(false), 2000);
}
```

#### 2. Modify ESC Handler

In `src/tui/app.js`, change the non-streaming branch:

```javascript
// Before:
if (isStreamingRef.current) {
  handleInterrupt();
} else {
  handleQuit();
}

// After:
// Onboarding check must come first (lines 819-821)
if (isOnboarding) {
  handleQuit();
} else if (isStreamingRef.current || hasActiveOperation) {
  handleInterrupt();
} else {
  // No active operation — still interrupt rather than quit
  handleInterrupt();
}
```

#### 3. Visual Feedback

Add a brief visual indicator when an operation is interrupted:
- Display `[interrupted]` or `[cancelled]` message in the status area
- Show for 2 seconds, then fade out
- Use existing status message infrastructure (no new UI components needed)

#### 4. Session State Preservation

Ensure the interrupt handler:
- Does not clear the conversation history
- Preserves the current session ID
- Cleans up only orphaned/intermediate state (tool-call messages from interrupted operation)
- Resets the abort controller for the next operation

### File Changes

1. **`src/tui/app.js`** (primary):
   - Modify ESC key handler (lines 841-848)
   - Enhance `handleInterrupt()` to handle non-streaming scenarios
   - Add visual feedback for interruption
   - Preserve onboarding ESC behavior (no changes to lines 819-821)

2. **`src/tui/inputPanel.js`** (secondary):
   - Ensure input buffer is cleared on interrupt
   - Verify no pending input operations remain

3. **`src/session/stateManager.js`** (potential):
   - Add `interrupt()` method if not already present
   - Ensure session state is preserved during interrupt

4. **`openspec/specs/streaming-interruption/spec.md`** (spec update):
   - Extend to cover non-streaming interrupt scenarios
   - Add visual feedback requirements

5. **`openspec/specs/tui-esc-interrupt/spec.md`** (new spec):
   - Define ESC interrupt behavior across all contexts
   - Document exceptions (onboarding, panels)

### Edge Cases

1. **Rapid ESC presses**: Debounce or ignore subsequent ESC presses within 500ms of an interrupt
2. **Interrupt during file write**: Cancel the file operation and clean up partial writes
3. **Interrupt during search/query**: Cancel the async operation and return to prompt
4. **Multiple concurrent operations**: Only interrupt the most recent/active operation
5. **Interrupt during onboarding**: Protected by `isOnboarding` check — ESC still exits

### Testing Strategy

- Unit tests for `handleInterrupt()` in various states (streaming, file write, search)
- Integration tests for ESC key handling in TUI
- Verify onboarding ESC still exits (regression test)
- Verify panel ESC still exits panel (regression test)
- Test rapid ESC presses (no crashes)