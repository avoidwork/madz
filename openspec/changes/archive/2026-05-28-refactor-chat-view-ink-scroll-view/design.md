## Context

The TUI chat view (`ConversationPanel` in `src/tui/conversationPanel.js`) currently implements custom virtualization. When the conversation exceeds the visible terminal height, `getVisibleMessages()` in `messages.js` slices the messages array and `calcVisibleCount()` determines how many messages fit. Scroll state (`scrollOffset`, `isScrolling`) lives in `app.js` and is passed as props down to `ConversationPanel`. Keyboard input for scrolling is handled at the app level via `useInput`, but the actual scroll behavior is fragmented across multiple files.

The `ink-scroll-view` library provides a `ScrollView` component that handles:
- Auto-measurement of child heights (critical since messages have variable line counts)
- Keyboard-driven scrolling via ref methods (`scrollBy`, `scrollTo`, etc.)
- Terminal resize handling via `remeasure()`
- Dynamic content updates (adding streaming messages, tool call expansion)

## Goals / Non-Goals

**Goals:**
- Consolidate scroll state management into `ScrollView` via a single ref in `ConversationPanel`.
- Eliminate `getVisibleMessages()` and `calcVisibleCount()` custom virtualization logic.
- Provide reliable keyboard scrolling (`↑`/`↓`/`pageUp`/`pageDown`) controlled within `ConversationPanel`.
- Handle terminal resize events to remeasure scroll content.
- Maintain the exact same user-visible behavior (scrollable message list, same key bindings).

**Non-Goals:**
- Refactoring the memory, skills, or settings panels (their scroll models are different -- list selection, not message history).
- Changing the message rendering/bubble UI (colors, alignment, tool call display).
- Converting the TUI to TypeScript (the project uses plain JavaScript).

## Decisions

### Decision 1: Use `ScrollView` (uncontrolled) instead of `ControlledScrollView`

The `ink-scroll-view` library provides two components:
- `ScrollView` -- manages scroll offset internally, exposes ref methods.
- `ControlledScrollView` -- accepts `scrollOffset` as a prop for external control.

**Choice: `ScrollView`** with a ref.

**Rationale:** The current `scrollOffset` state in `app.js` exists solely for the conversation panel. Moving scroll state into the panel itself reduces cross-component coupling. `app.js` already manages state for panel navigation, session, and auth -- removing scroll state simplifies it.

**Alternative considered:** `ControlledScrollView` with state in `app.js`. Rejected because it keeps scroll state in the wrong component -- the conversation panel is the only consumer.

### Decision 2: Move scroll key handling into `ConversationPanel`

**Choice:** The `ConversationPanel` component itself uses `useInput` (from Ink) to handle `↑`, `↓`, `pageUp`, `pageDown` and calls `scrollRef.current.scrollBy()`.

**Rationale:** This is the idiomatic `ink-scroll-view` pattern (see their example). The scroll panel owns its interaction. `app.js`'s `useInput` only handles panel navigation (Tab/Shift+Tab) and command parsing.

**Alternative considered:** Keep all input handling in `app.js` and forward key events via callbacks. Rejected because it makes the input handler harder to maintain -- the scroll panel would need to know about its own scroll state.

### Decision 3: Wire terminal resize to `remeasure()` via `useStdout`

**Choice:** Add a `useEffect` in `ConversationPanel` that listens to `stdout` resize events and calls `scrollRef.current.remeasure()`.

**Rationale:** `ink-scroll-view` auto-measures child heights on mount, but terminal resize changes the container dimensions. The library docs explicitly call out this pattern.

**Alternative considered:** A global resize listener in `app.js` passed via props. Rejected because it creates a cross-component dependency for a concern local to the panel.

### Decision 4: Auto-scroll-to-bottom on new messages

**Choice:** `ConversationPanel` tracks `messages.length` with a `useRef`. When the length increases (a new message was added), call `scrollRef.current.scrollToBottom()`.

**Rationale:** The old implementation called `setScrollOffset(0)` on new messages, which jumps to the top -- a clearly broken UX. The `ink-scroll-view` library provides `scrollToBottom()` on the ref, which is the natural way to follow new content. Scrolling on every new message (including streaming placeholders) is simpler than adding a "is user viewing history" indicator, and acceptable for a terminal chat UI where following is the dominant interaction.

**Alternative considered:** Only scroll when the user is already near the bottom (tracking previous scroll position). Rejected because adding scroll-position-aware logic introduces complexity and edge cases the refactor scope does not require.

### Decision 5: Keep a reduced `messages.js` utility module

**Choice:** Remove `getVisibleMessages()` and `calcVisibleCount()` from `messages.js`. Keep `getRoleLabel()`, `isStreamingMessage()`, `countMessageLines()` (if used for other purposes), and `formatMessage()`.

**Rationale:** These utility functions are still needed for rendering individual messages. Only the aggregation/virtualization functions are removed. If tests import `getVisibleMessages`, the tests must be updated (or removed, since the behavior is now tested through component behavior).

### Decision 5: No scroll-to-bottom auto-follow for streaming

**Choice:** Do not implement auto-scroll-to-bottom when new streaming messages arrive. This is deferred.

**Rationale:** This is a behavior change that the user has not requested. Auto-follow would require observing when new messages are appended and calling `scrollToBottom()`. Adding it now introduces a new feature beyond the refactor scope.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| `ink-scroll-view` is new/unfamiliar to the team | It has a clear ref-based API with documented methods. Start with the scroll example from their README as the template. |
| `ScrollView` renders all children (not truly virtualized) | The library docs confirm this but note it is efficient because children are shifted via `marginTop` with `overflow: hidden` on the parent. For typical conversation depth (<500 messages) this is acceptable. |
| Terminal resize might cause flash/layout shift during re-measurement | Call `remeasure()` on the same tick as the Ink `rerender`. If flash is noticeable, `ControlledScrollView` with a brief offset freeze could be added later. |
| Test coverage for removed functions (`getVisibleMessages`, `calcVisibleCount`) | Tests for these pure functions should be migrated to test scroll behavior via the `ScrollView` ref, or removed if they become redundant with integration tests. |
| Variable-height messages (especially tool call blocks) might not be measured instantly | `ink-scroll-view` uses a virtual DOM measurement pass. Initial render may have a slight delay. Subsequent renders via streaming will use `remeasureItem` internally. |
