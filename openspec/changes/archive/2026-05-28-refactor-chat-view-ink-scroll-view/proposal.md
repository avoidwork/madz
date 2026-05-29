## Why

The current chat view uses a hand-rolled virtualization approach: it manually slices the messages array, tracks scroll offset in external state, and calculates visible ranges via `getVisibleMessages()` and `calcVisibleCount()` in `messages.js`. This custom approach has several problems:

- Scroll state management is scattered across `app.js` (state), `messages.js` (slice logic), and `conversationPanel.js` (rendering).
- Terminal resize handling is incomplete -- arrow key scrolling exists but resize-based re-measurement is missing.
- The TUI's other panels (memory, skills, settings) use even simpler scroll models that don't unify with the conversation panel.
- The `tui-interface` spec already requires a "scrollable terminal buffer" -- a shared scroll component would make this requirement cleaner and more maintainable.

Switching to `ink-scroll-view` eliminates custom scroll math, provides reliable auto-measurement of dynamic message heights, and gives keyboard-driven scrolling via a single ref API.

## What Changes

- Add `ink-scroll-view` as a production dependency.
- Replace the custom `getVisibleMessages()` / `calcVisibleCount()` virtualization in `messages.js` with `ScrollView` from `ink-scroll-view`.
- Remove `scrollOffset` and `isScrolling` state from `app.js` -- scroll position is managed internally by `ScrollView` via ref.
- Move scroll key handling (`↑`/`↓`/`pageUp`/`pageDown`) into `ConversationPanel` via `useInput`, driven by the `ScrollView` ref.
- Wire terminal `resize` events to call `remeasure()` on the scroll ref (using `useStdout`).
- Keep the existing message rendering in `conversationPanel.js` (message bubbles, tool call display, timestamps) -- only the scroll container changes.
- Simplify `app.js` -- it passes only `messages` and `assistantName` as props to `ConversationPanel`, no longer manages scroll state.

## Capabilities

### New Capabilities

- `tui-scroll-view`: Use `ink-scroll-view` ScrollView component for the conversation panel with keyboard scroll control, terminal resize handling, and auto-measurement of dynamic message content.

### Modified Capabilities

- `tui-interface`: Scrollable terminal buffer requirement shifts from custom manual slicing to `ink-scroll-view`-backed scrolling. The keyboard interaction contract (up/down arrows, page-up/page-down) remains identical from the user's perspective.

## Impact

**Files modified:**
- `src/tui/app.js` -- Remove scroll state, pass simplified props to ConversationPanel, keep panel navigation and terminal resize for scroll ref.
- `src/tui/conversationPanel.js` -- Add ScrollView wrapper, add `useInput` for scroll keys, add `useStdout` for resize handling via `remeasure()`.
- `src/tui/messages.js` -- Remove `getVisibleMessages()` and `calcVisibleCount()` (no longer needed). If other consumers exist, keep them temporarily or migrate.

**Files added:**
- No new files; this is a refactor.

**Dependencies added:**
- `ink-scroll-view` (peer: `ink`, `react` which already exist).

**Breaking changes:**
- `getVisibleMessages()` and `calcVisibleCount()` export removals from `messages.js` if they have no external consumers. If tests import them, the tests must be updated.
