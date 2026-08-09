## Context

The TUI uses Ink's `useInput()` hook at the app level (`src/tui/app.js:809`) as the sole key event gatekeeper. This hook captures ALL key events before they reach child components. When the inputBar is focused, key events are intercepted and never bubble to the message list, preventing its auto-scroll behavior during streaming responses.

Current state:
- `useInput()` in `src/tui/app.js` handles all key events globally
- When `inputFocused` is true: processes escape, upArrow, downArrow but keys fall through without explicit handling
- When `inputFocused` is false: intercepts upArrow, downArrow, pageUp, pageDown for manual scroll
- Message list has `scrollBy()` methods but cannot receive key events directly

## Goals / Non-Goals

**Goals:**
- Restructure `useInput()` to be focus-aware — only intercept keys relevant to the focused panel
- Allow key events to bubble through to the message list when inputBar is focused
- Preserve all existing keyboard behavior (Tab, Escape, up/down/pageUp/pageDown)
- Ensure global keys (Tab, Escape) work regardless of focus state

**Non-Goals:**
- Changes to message list internal scroll logic
- Changes to Ink library or core TUI framework
- Adding new keyboard shortcuts
- Changes to streaming behavior or response rendering

## Decisions

### Decision 1: Focus-aware conditional interception
**Choice:** Restructure `useInput()` to check `inputFocused` state and only intercept keys relevant to the focused panel.

**Rationale:** This is the cleanest approach that aligns with the principle of least privilege for event handling. The hook already has access to `inputFocused` state, so minimal changes are needed.

**Alternatives considered:**
- Event forwarding: Create a separate event bus to forward keys from app to focused component. Adds complexity and a new abstraction layer.
- Component-level hooks: Move `useInput` to individual components. Breaks global key handling (Tab, Escape) and requires significant refactoring.
- Focus-aware return values: Use Ink's `useInput` return mechanism to conditionally prevent event capture. May not be supported by Ink's API.

### Decision 2: Global keys always handled at app level
**Choice:** Tab and Escape are always handled at the app level, regardless of focus state.

**Rationale:** These are truly global actions — Tab toggles focus between panels, Escape quits/interrupts the entire app. They should not be delegated to any single panel.

### Decision 3: Minimal changes to app.js
**Choice:** All changes localized to `src/tui/app.js` `useInput()` handler. No changes to messageList.js or other components.

**Rationale:** The root cause is the global capture in app.js. Fixing it there is the most targeted approach. The message list's auto-scroll behavior already works — it just needs to receive the key events.

## Risks / Trade-offs

[Risk] Ink's `useInput` may not support conditional event passing — it may always capture events regardless of handler logic.
→ Mitigation: If Ink doesn't support conditional passing, implement a simple event forwarding mechanism where the app-level handler explicitly calls the message list's scroll methods when relevant keys are pressed while inputBar is focused.

[Risk] Race conditions during focus transitions — events may be lost when switching between inputBar and message list.
→ Mitigation: Ensure focus state updates are synchronous and the handler checks the latest state on every key event.

[Risk] Regression of existing keyboard behavior.
→ Mitigation: Comprehensive testing of all keyboard interactions (Tab, Escape, up/down/pageUp/pageDown in both focused states).

## Migration Plan

No migration needed — this is a behavioral fix with no API changes. The fix is deployed by merging the PR to main.

## Open Questions

- Does Ink's `useInput` support conditional event passing, or does it always capture? This determines whether the simple conditional approach works or if event forwarding is needed.
- Are there any other components besides the message list that depend on key event bubbling?
