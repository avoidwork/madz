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

### Decision 1: Message Update via Pub/Sub Topics (Replaces Ref Callbacks)
Use a pub/sub topic system for streaming updates to individual bubbles. Each bubble subscribes to a unique topic (`msg-{id}`) on mount. When `MessageList.updateMessage(id, updates)` is called, it publishes to that topic. The subscribed bubble receives the update and appends to its local chunks state, triggering a re-render.

**Rationale:** The original plan used `React.forwardRef` + `useImperativeHandle` to expose an `update()` method on each bubble, with MessageList holding a `Map<string, RefObject>` of bubble refs. During implementation, a pub/sub architecture was adopted instead because:

1. **Simpler architecture:** No need for ref Map management, forwardRef on every bubble, or useImperativeHandle boilerplate. MessageList only needs to maintain its own data store and topic registry.
2. **No child refs in parent:** MessageList doesn't need to track bubble instances at all. Bubbles self-register their subscriptions.
3. **Natural 1-to-N support:** If a bubble were ever to have multiple subscribers, pub/sub handles it trivially. Ref callback updates would need manual iteration.
4. **Test isolation:** Pub/sub topics can be verified independently of React rendering (see tests section).
5. **Decouples lifecycle:** Bubble unmount automatically unsubscribes. No need for cleanup of stale refs when messages are cleared or windowed.

**Alternatives considered:**
- **forwardRef + useImperativeHandle:** The original plan. More React-idiomatic for imperative child methods but requires ref tracking in parent, adds boilerplate, and tightly couples MessageList to bubble implementation details.
- **Context provider:** Pass a central update function via React Context. Adds overhead for a simple message→bubble pattern. Topics are more targeted.
- **Direct state in MessageList:** Keep all state in MessageList, pass props down to bubbles. Works for simple cases but makes streaming updates (cursor character cycling) require full list re-renders.

### Decision 2: Chunk Accumulation with Deduplication
Each `MessageBubble` tracks a `chunks` state (`useState([])`). Streaming updates arrive as string chunks via pub/sub. Each chunk is appended to the array (with deduplication: `if (prev[prev.length-1] === chunk) return prev`). The content rendered is `chunks.join('')`.

**Rationale:** Chunk-based accumulation avoids string concatenation on every render tick. Deduplication prevents duplicate chars when the same content is published multiple times (handles race conditions in streaming handlers). Joining a small array is cheap.

**Alternatives considered:**
- **streamingId counter:** Track a separate counter state to force re-renders when content hasn't changed. Works but adds a useless state variable. Chunk append naturally triggers re-render while also carrying payload.
- **useEffect dependency:** Use a separate `key` prop. Changes component identity, losing scroll position. Not compatible with ink-scroll-view.

### Decision 3: MessageList Owns ScrollView and Scroll Logic
All scroll management (throttle, resize, manual scroll detection, keyboard scroll) moves from `ConversationPanel` to `MessageList`. `MessageList` exposes an internal scroll ref via `getScrollRef()`, which App.js uses for keyboard navigation.

**Rationale:** The ScrollView is part of `MessageList`'s visual output. Having MessageList own scroll behavior keeps the component self-contained. App.js accesses the ScrollView ref through the imperative handle (`messageListRef.current?.getScrollRef()`) rather than prop-based forwarding, which simplifies the ConversationPanel's prop interface.

**Alternatives considered:**
- **Prop-based scrollRef forwarding:** Pass `scrollRef` as a prop from App.js → ConversationPanel → MessageList. More explicit but requires threading through an extra layer.
- **Keep scroll in ConversationPanel:** Would require passing MessageList ref to ConversationPanel for scroll-to-bottom. More indirection and tighter coupling.

### Decision 4: Keep messages useState in App.js as Sync Boundary
The `messages` state in App.js is not removed. It stays as the source of truth for session persistence and is synced into MessageList via an `initialize(msgs)` call when a session loads.

**Rationale:** MessageList needs to know what messages to display on session restore. The App.js → MessageList interface is: initial state via `setMessages()` on mount, subsequent updates via imperative methods. This hybrid approach is simpler than making MessageList the sole source of truth and dealing with session state synchronization complexity.

## Risks / Trade-offs

1. **[Risk: Pub/sub overhead]** Topics are created per message and stored in a Map. For long conversations with 100+ messages, this is 100 topic arrays in memory.
   → [Mitigation: Topics are lightweight (just event lists). Bubbles unsubscribe on unmount. For 100 visible messages this is negligible.]

2. **[Risk: Scroll regression]** The scroll behavior (throttle, manual-detection) is non-trivial. Moving it could introduce regressions.
   → [Mitigation: Port the scroll code verbatim from ConversationPanel.js, only changing the ref targets. Use the same throttling and content-hash patterns.]

3. **[Risk: Bubble ID stability]** Message IDs must be stable across renders for `updateMessage` to find the right bubble.
   → [Mitigation: Use a monotonic counter (assigned at add time) rather than random IDs. Map ID → data, not ref → ID.]

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
4. Should the legacy `MessageBubble` and `renderMessages` in `conversationPanel.js` be removed after this change, or kept as utilities? (Decision: kept as exports for backward compatibility, but they are unused.)
