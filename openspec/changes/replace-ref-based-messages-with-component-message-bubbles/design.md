## Context

The TUI conversation panel in `src/tui/app.js` and `src/tui/conversationPanel.js` uses a pattern where messages are stored in a React state array and updated by cloning the array and mutating the last element. This approach was the only viable option before the adoption of `ink-scroll-view` which replaced the custom virtualized renderer (`messages.js`). However, the pattern has become a liability:

- Every streaming tick clones the full messages array and updates the last element, creating GC pressure
- The `ConversationPanel` owns both rendering and scroll logic, making it 365 lines and tightly coupled
- When a message is added, all messages are re-rendered even though only the new message should render
- App.js contains ~12 scattered `setMessages(prev => {...})` call sites across `handleChat`, `handleCommand`, `handleInterrupt`, and `handleNewSession`

The `ink-scroll-view` library (already in use) provides virtualized scrolling, meaning the React tree no longer needs to track every line. This makes a component-based approach (one component per message) viable — the ScrollView handles virtualization efficiently.

## Goals / Non-Goals

**Goals:**
- Each message is a standalone `MessageBubble` component with its own `useState`
- `MessageList` provides an imperative API (`addMessage`, `updateMessage`, `clear`, `setMessages`)
- Scroll management moves from `ConversationPanel` to `MessageList`
- App.js replaces array-mutation state updates with imperative ref calls
- Streaming text appears in real-time; user messages appear immediately
- No visual regression — same colors, layout, behavior as current UI

**Non-Goals:**
- Changing message styling or visual design
- Adding new message types (images, cards, etc.)
- Adding message search or filtering
- Changing the session loading/persistence mechanism
- Adding message reactions, editing, or deletion
- Migrating away from React state in App.js entirely (messages state remains as sync boundary)

## Decisions

### Decision 1: Imperative Update via Forwarded Ref
Use `React.forwardRef` on `MessageBubble` to expose an `update(partialState)` method. `MessageList` stores refs in a `Map<string, RefObject>`. When `MessageList.updateMessage(id, updates)` is called, it looks up the ref and calls its update method.

**Rationale:** Ink supports `React.forwardRef` (it's a React feature). This gives the same imperative control that the previous approach had with `messagesRef` mutations, but through React's component model instead of a plain mutable array.

**Alternatives considered:**
- **Context provider:** Pass a central update function via React Context. Adds overhead for a simple parent→child pattern. Refs are more direct.
- **State-driven updates:** Keep all state in `MessageList`, pass down props. This works for simple cases but makes streaming updates (cursor character cycling) harder because every prop change re-renders the entire list of bubbles.
- **Event emitter:** Use a simple pub/sub. Adds a dependency and indirection. Refs are standard React.

### Decision 2: Internal streamingId Counter in MessageBubble
Each `MessageBubble` tracks a `streamingId` state counter. Streaming updates increment this counter (e.g., every tick of the cursor animation or every streaming character). This ensures Ink re-renders the component even when content hasn't changed visually.

**Rationale:** Ink may batch renders. If the content string is identical, Ink might skip re-render. The counter acts as a "bump" to force updates. This is the same pattern some Ink apps use for cursor animation.

**Alternatives considered:**
- **useEffect dependency:** Use a separate `key` prop on the component. Changes the component identity on every render, losing scroll position and DOM refs. Not compatible with ink-scroll-view which needs stable children IDs.
- **CSS animation:** Cursor blinking via CSS. Ink supports limited CSS. The `\u2588` character is fine, but we need a reliable way to force re-render for smooth cursor.

### Decision 3: MessageList Owns ScrollView and Scroll Logic
All scroll management (throttle, resize, manual scroll detection, keyboard scroll) moves from `ConversationPanel` to `MessageList`. `ConversationPanel` becomes a 10-line wrapper.

**Rationale:** The ScrollView is part of `MessageList`'s visual output. Having MessageList own scroll behavior keeps the component self-contained. ConversationPanel can forward the ScrollView ref to App.js for keyboard navigation via a `scrollRef` prop or method.

**Alternatives considered:**
- **Keep scroll in ConversationPanel:** Would require passing MessageList ref to ConversationPanel for scroll-to-bottom. More indirection.

### Decision 4: Keep messages useState in App.js as Sync Boundary
The `messages` state in App.js is not removed. It stays as the source of truth for session persistence and is synced into MessageList via an `initialize(msgs)` call when a session loads.

**Rationale:** MessageList needs to know what messages to display on session restore. The App.js → MessageList interface is: initial state via prop, subsequent updates via imperative methods. This hybrid approach is simpler than making MessageList the sole source of truth and dealing with session state synchronization complexity.

## Risks / Trade-offs

1. **[Risk: Ink forwardRef compatibility]** Ink might not properly forward refs on functional components.
   → [Mitigation: Test with a simple forwarded-ref component first. If it fails, fall back to a callback ref pattern or a MessageContext pattern.]

2. **[Risk: Scroll regression]** The scroll behavior (throttle, manual-detection) is non-trivial. Moving it could introduce regressions.
   → [Mitigation: Port the scroll code verbatim from ConversationPanel.js (lines 260-353), only changing the ref targets. Test with the existing `tests/unit/tui/conversationPanel.test.js` as reference.]

3. **[Risk: Bubble ID stability]** Message IDs must be stable across renders for `updateMessage` to find the right bubble.
   → [Mitigation: Use a monotonic counter (assigned at add time) rather than random IDs. Map ID → ref, not ref → ID.]

## Migration Plan

1. Create `messageBubble.js` and `messageList.js` with all new code
2. Update `conversationPanel.js` to be a thin wrapper
3. Update `app.js` — replace all `setMessages` with imperative calls
4. Run tests and fix any failures
5. Run `npm run lint` and fix any lint issues
6. Run `npm start` briefly to verify the app boots without errors

## Open Questions

1. Should the cursor character be sourced globally (context) or per-component (prop from MessageList from app props)?
2. Is a monotonic counter sufficient for bubble IDs, or should we use `crypto.randomUUID()` for uniqueness across session loads? (Answer for now: monotonic counter is simpler and sufficient within a session.)
3. How should `MessageBubble` handle empty content during streaming (just a blinking cursor)?
