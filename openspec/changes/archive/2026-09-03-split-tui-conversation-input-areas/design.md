## Context

`src/tui/app.js` is a 1042-line monolith holding all TUI state: conversation/streaming (`chatHistory`, `contextSize`, `isCompacting`, 8 refs) and input/status (`inputText`, `inputFocused`, `historyIndex`, `statusMessage`, `skillCount`). Every state change re-renders the entire tree — 200+ `MessageBubble` components on each keystroke. The existing `React.memo` + `areEqual` comparator (lines 22-49) never fires because the component re-renders due to its own state changes.

The fix is structural: split the tree into two isolated subtrees under a thin App router.

## Goals / Non-Goals

**Goals:**
- Typing re-renders only InputArea (MessageList untouched)
- Streaming status updates re-render only InputArea (StatusBar)
- New messages re-render only ConversationArea (InputPanel untouched)
- Zero cross-tree re-renders
- No user-visible behavior change

**Non-Goals:**
- No virtualization layer
- No state management library
- No changes to `messageList.js` / `messageBubble.js` internals
- No new dependencies

## Architecture

```
App (thin router — ~100 lines)
│  State: showBanner, showOnboarding, onboardingResponse, inputFocused
│  Refs:  lastInterruptTimeRef, exitRef, conversationAreaRef, inputAreaRef
│  Hooks: useInput (focus-aware key routing), useApp (exit)
│
├── ConversationArea (owns conversation/streaming state)
│   │  State: contextSize, isCompacting
│   │  Refs:  messageListRef, abortControllerRef, isStreamingRef,
│   │         dispatchPromiseRef, streamingMsgIdRef, tokenCacheRef,
│   │         autoContinueCountRef, isAutoContinuingRef
│   │  Handlers: handleInterrupt, handleCommand, handleChat,
│   │            createStreamingHandler, finalizeStreaming,
│   │            updateContextSize, addMessage, handleNewSession, shouldAbort
│   │  Props from App: config, registry, sessionState, dispatchProvider,
│   │                  scheduleManager, appInfo, onSaveSession, gcManager,
│   │                  gcTrigger, onStatusChange, onContextChange,
│   │                  onCompactingChange, onInterruptInput, onNewSessionInput
│   │  Exposes (via ref): scrollBy, getViewportHeight, interrupt,
│   │                     handleCommand, handleChat, newSession, clear,
│   │                     addMessage, messageCountRef
│   │
│   └── ConversationPanel (message list — unchanged)
│
└── InputArea (owns input/status state)
    │  State: inputText, historyIndex, chatHistory, statusMessage,
    │         contextSize, isCompacting
    │  Props from App: onSubmit, onFocus, onBlur, focus, skillCount,
    │                  messageCountRef, showBanner, showOnboarding
    │  Exposes (via ref): navigateHistory, clearInput, getInputText,
    │                     clearHistory, setStatusMessage, setContextSize,
    │                     setIsCompacting
    │
    ├── StatusBar (unchanged, reads messageCount from messageCountRef)
    └── InputPanel (unchanged)
```

## Decisions

### 1. Imperative refs for cross-area communication

**Decision:** App holds `conversationAreaRef` and `inputAreaRef`. Each area exposes imperative methods via `forwardRef` + `useImperativeHandle`.

**Why:** The `useInput` hook in App must route keys to both areas without holding their state. Imperative refs let App call `inputAreaRef.current?.navigateHistory('up')` or `conversationAreaRef.current?.scrollBy(-1)` without re-rendering either area. This avoids the re-render cascade that a state-lifting approach would cause.

**Alternative considered:** React context for state distribution. Rejected — context value changes re-render all consumers, defeating the isolation goal.

### 2. Status/context flow: ConversationArea → InputArea via stable callbacks

**Decision:** App creates stable callbacks (`onStatusChange`, `onContextChange`, `onCompactingChange`) that call `inputAreaRef.current?.setStatusMessage(msg)` etc. These are passed to ConversationArea as props. ConversationArea calls them when streaming state changes.

**Why:** App holds NO status/context/compacting state. Status changes flow directly from ConversationArea into InputArea's internal state. Only InputArea re-renders. App and ConversationArea are untouched.

**Alternative considered:** App holds status state and passes as props to InputArea. Rejected — App re-render on every status change would re-render both areas.

### 3. `messageCountRef` for StatusBar

**Decision:** ConversationArea maintains a plain `messageCountRef` (updated on `addMessage`/`clear`). InputArea reads it for StatusBar's `messageCount` prop.

**Why:** StatusBar needs the message count but must not couple to ConversationArea's internal `messageListRef`. A plain ref is zero-cost to read and doesn't trigger re-renders.

### 4. `chatHistory` + `historyIndex` live in InputArea

**Decision:** Input history (up/down arrow navigation) is purely an input concern. `chatHistory` and `historyIndex` move to InputArea.

**Why:** They are only read/written by `handleSubmit`, `processOnboardingInput`, and the `useInput` history-nav branch. None of these are conversation concerns.

**Note:** `processOnboardingInput` stays in App (it manages `showOnboarding`/`showBanner`). It reads `inputText` via `inputAreaRef.current?.getInputText()` and clears via `inputAreaRef.current?.clearInput()`.

### 5. `handleInterrupt` cross-area effect

**Decision:** `handleInterrupt` lives in ConversationArea (it owns abort/streaming refs). When it fires, it calls `onInterruptInput()` (App-wired callback → `inputAreaRef.current?.clearInput()`) to clear the input buffer.

**Why:** The interrupt logic is 90% conversation state (abort controller, streaming refs, session cleanup). The one input effect (clear input text) is a single callback.

### 6. `handleNewSession` is an App-level router

**Decision:** App's `handleNewSession` calls `conversationAreaRef.current?.newSession()` AND `inputAreaRef.current?.clearHistory()`.

**Why:** New session resets both areas. Neither area should know about the other.

### 7. `useInput` stays in App

**Decision:** The `useInput` hook remains in App. It routes:
- Onboarding Enter → `processOnboardingInput(inputAreaRef.current?.getInputText())`
- Banner dismiss → `setShowBanner(false)`
- Tab → `setInputFocused(prev => !prev)`
- Escape → debounce check → `conversationAreaRef.current?.interrupt()`
- Input focused + up/down → `inputAreaRef.current?.navigateHistory(dir)`
- Message focused + up/down/pageUp/pageDown → `conversationAreaRef.current?.scrollBy(delta)` / `getViewportHeight()`

**Why:** Key routing is the cross-cutting concern that justifies App's existence. Moving it into either area would create a circular dependency.

### 8. `handleSubmit` split

**Decision:** InputArea owns the input-side of submit (trim, history tracking, clear input). It calls `onSubmit(text)` (App prop). App's `handleSubmit` handles the conversation-side: if streaming → `conversationAreaRef.current?.interrupt()`, then route to `handleCommand` or `handleChat` on ConversationArea.

**Why:** Clean separation. InputArea never touches conversation state. ConversationArea never touches input state.

## Risks / Trade-offs

- **[Ref timing]** `inputAreaRef.current` may be null on first render if InputArea hasn't mounted yet. → Mitigation: all ref calls use optional chaining (`?.`). App renders both areas in the same commit, so refs are populated before any user interaction.
- **[Onboarding input]** `processOnboardingInput` reads `inputText` via ref instead of state. → Mitigation: `getInputText()` returns the current value synchronously. No async gap.
- **[StatusBar messageCount]** Reading a plain ref doesn't trigger re-renders. → Mitigation: `messageCountRef` is read during InputArea's render (which happens on every status/input change). The count is only stale if a message is added without a concurrent status change — which doesn't happen in practice (every `addMessage` is paired with a status update).
- **[Test surface]** Existing tests target `App` as a monolith. → Mitigation: new unit tests for `ConversationArea` and `InputArea` boundaries; existing TUI integration tests must pass unchanged.

## Migration Plan

1. Create `src/tui/conversationArea.js` — extract conversation/streaming state and handlers from `app.js`.
2. Create `src/tui/inputArea.js` — extract input/status state and render StatusBar + InputPanel.
3. Thin `src/tui/app.js` to router: cross-cutting state, `useInput` routing, area refs, render both areas.
4. Update `src/tui/index.js` exports.
5. Run `npm run test` and `npm run coverage`.
6. Rollback: revert the branch. No data migration, no API changes.

## Open Questions

None — the issue provides a complete design. All decisions above are derived from it.
