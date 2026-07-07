## Context

The TUI in `src/tui/app.js` uses a ref-based message architecture that fights React's rendering model. Messages are stored in `messagesRef` (a mutable ref array), and re-renders are forced via `forceRender` (a useState counter) combined with array spreading. This causes:

- Memory leaks from constant array allocation during streaming
- Unnecessary re-renders of unchanged messages
- Complex scroll management that doesn't work reliably
- User messages don't appear until the assistant message streams in

The current `ConversationPanel` component is ~7579 bytes with scroll logic, refs, and message rendering all coupled together. Utility functions in `src/tui/messages.js` (getRoleLabel, formatMessage, isStreamingMessage, countMessageLines, getToolCallLines) support the current rendering but need to be reused by the new MessageBubble component.

## Goals / Non-Goals

**Goals:**
- Replace ref-based message array with component-based architecture
- Each message is a standalone MessageBubble component managing its own state
- MessageList manages bubble instances with addMessage(), updateMessage(), clear() methods
- Eliminate forceRender, renderCount, and messagesRef entirely
- Move scroll management into MessageList internally
- Simplify ConversationPanel to a thin wrapper
- Maintain MAX_RENDER_MESSAGES windowing for performance
- All 1072 existing tests pass

**Non-Goals:**
- Changing the message data model or API contract
- Adding new message types or rendering features
- Refactoring other TUI components
- Changing the streaming protocol or backend behavior

## Decisions

### Decision 1: Component Instances Over Data Arrays
**Choice:** MessageList holds React element instances (not plain data arrays).
**Rationale:** Leverages React's reconciliation and state management. Each bubble has its own useState and can update independently. Only changed bubbles re-render, eliminating the O(n) re-render of the entire message list.
**Alternatives considered:**
- Keep data array + useMemo for rendering — still requires array spreading to trigger re-renders
- Use a single component with internal state for all messages — loses independent bubble updates

### Decision 2: Imperative Update Method via useImperativeHandle
**Choice:** MessageBubble exposes a `update()` method via `useImperativeHandle` for streaming handlers to call directly.
**Rationale:** Streaming handlers receive rapid, sequential updates. Calling `bubble.update(chunk)` is synchronous and avoids async state batching issues. It's simpler than dispatching actions through a reducer.
**Alternatives considered:**
- Callback props — would require lifting state up, complicating the component tree
- Context API — overkill for a parent-child update pattern
- State management library — unnecessary complexity for this use case

### Decision 3: Internal Scroll Management
**Choice:** MessageList handles scroll-to-bottom internally via its own ref.
**Rationale:** Eliminates the need for external useEffect-based scroll logic and the associated array spreading. The scroll behavior is tightly coupled to message updates, so it belongs inside MessageList.
**Alternatives considered:**
- External scroll management via props — requires array spreading to trigger updates
- ControlledScrollView with scrollOffset state — adds state management complexity

### Decision 4: Stable Bubble IDs via randomUUID
**Choice:** Each bubble gets a stable ID generated at creation time.
**Rationale:** Ensures proper React reconciliation during updates and removals. Without stable keys, React would remount bubbles on every render, losing their internal state.
**Alternatives considered:**
- Index-based keys — breaks on insertions/deletions in the middle of the list
- Timestamp-based keys — not guaranteed unique under rapid streaming

### Decision 5: MAX_RENDER_MESSAGES Windowing
**Choice:** MessageList implements windowing to limit rendered bubbles to MAX_RENDER_MESSAGES.
**Rationale:** Prevents performance degradation with very long conversations. Only the most recent N messages are rendered in the DOM.
**Alternatives considered:**
- Virtual scrolling — adds complexity, not needed for typical conversation lengths
- No windowing — DOM grows unbounded, causing memory and scroll performance issues

## Risks / Trade-offs

1. **More component instances** — One React component per message instead of one array. Mitigation: Only changed bubbles re-render, so total render work is typically less than the current O(n) full-list re-render.

2. **Ref forwarding complexity** — Using `useImperativeHandle` adds a layer of indirection. Mitigation: The update method is simple and well-documented; it's the cleanest approach for parent-to-child imperative updates.

3. **Memory per bubble** — Each bubble has its own state objects. Mitigation: This is offset by eliminating the constant array allocation of the old approach. Bubbles are garbage collected when removed from the list.

4. **Bubble identity on re-render** — If MessageList re-renders without changing its children array, bubbles retain their state. Mitigation: Stable IDs ensure React reconciles correctly; we use `useMemo` for the element array where appropriate.

5. **Streaming performance** — Rapid streaming could cause many individual updates. Mitigation: Each update is a simple useState call; React batches state updates within the same event loop tick.

## Migration Plan

1. Create `src/tui/messageBubble.js` with the new MessageBubble component
2. Create `src/tui/messageList.js` with the new MessageList component
3. Simplify `src/tui/conversationPanel.js` to render MessageList
4. Update `src/tui/app.js` to remove refs and use MessageList
5. Update test mocks in `tests/unit/tui/` for the new component API
6. Verify all tests pass and application starts correctly

No rollback strategy needed — this is a single-branch refactor with no data migration.

## Open Questions

1. Should MessageBubble accept a `key` prop explicitly, or derive it from the MessageList?
2. Should MAX_RENDER_MESSAGES be configurable or hardcoded?
3. Should MessageList expose a `scrollToTop()` method for future use?