## Why

The TUI message list fails to auto-scroll during streaming responses because the app-level `useInput()` hook in `src/tui/app.js` captures all key events globally. When the inputBar is focused, key events are intercepted before they can reach the message list component, preventing its auto-scroll behavior from triggering. This blocks the user from viewing streamed content without manual scrolling.

## What Changes

- Restructure the `useInput()` hook in `src/tui/app.js` to be focus-aware, only intercepting keys relevant to the currently focused panel
- When inputBar is focused: only intercept Enter (submit), Tab (focus toggle), and Escape (global). Allow all other keys to pass through to child components
- When message list is focused: allow the message list to handle its own navigation keys (up/down/pageUp/pageDown). App-level handler manages only global keys (Escape)
- Preserve all existing keyboard behavior: Tab toggles focus, Escape quits/interrupts, up/down/pageUp/pageDown navigate when message list is focused

## Capabilities

### New Capabilities
- `tui-event-routing`: Focus-aware key event routing in the TUI — keys are only intercepted by the focused panel, with global keys handled at app level regardless of focus state

### Modified Capabilities
- None (this is a behavioral fix, not a spec-level requirement change)

## Impact

- `src/tui/app.js` — `useInput()` hook (line ~809), input focus handling (lines 835-879)
- `src/tui/messageList.js` — auto-scroll behavior will now receive key events
- No API changes, no dependency changes
- Risk: Ink's `useInput` may not natively support conditional event passing; may require event forwarding workaround

## Non-goals

- Changes to the message list component's internal scroll logic
- Changes to Ink library or core TUI framework
- Adding new keyboard shortcuts or navigation features
- Changes to streaming behavior or response rendering
