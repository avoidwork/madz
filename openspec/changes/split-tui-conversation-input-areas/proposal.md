## Why

The TUI's React tree is a single monolith: `src/tui/app.js` (~1042 lines) holds ALL state — conversation/streaming (`chatHistory`, `contextSize`, `isCompacting`, and 8 refs) and input/status (`inputText`, `inputFocused`, `historyIndex`, `statusMessage`, `skillCount`). Any state change re-renders the entire tree, including 200+ `MessageBubble` components, on every keystroke and every streaming status update. The existing `React.memo` + custom `areEqual` comparator (app.js:22-49) is a band-aid that never fires, because the component re-renders due to its own state changes. This causes the sluggish input experience users report.

## What Changes

- **New** `src/tui/conversationArea.js` — owns all conversation/streaming state and handlers (`handleInterrupt`, `handleChat`, `handleCommand`, `createStreamingHandler`, `finalizeStreaming`, `updateContextSize`, `addMessage`, `handleNewSession`); renders `ConversationPanel`; exposes a `messageCountRef` (plain ref, updated on message add/clear).
- **New** `src/tui/inputArea.js` — owns all input/status state (`inputText`, `inputFocused`, `historyIndex`, `statusMessage`, `contextSize`, `isCompacting`, `skillCount`, `messageCount`); renders `StatusBar` and `InputPanel`; reads `messageCount` from the ref exposed by ConversationArea.
- **Modified** `src/tui/app.js` — thinned to a ~100-line router: only cross-cutting state (`showBanner`, `showOnboarding`, `onboardingResponse`, `inputFocused`), thin router handlers (`handleSubmit`, `handleInterrupt`, `handleNewSession`, `handleQuit`), and the `useInput` hook with focus-aware key routing.
- **Modified** `src/tui/index.js` — export the two new components.
- **Unchanged** `messageList.js`, `messageBubble.js`, `conversationPanel.js`, `inputPanel.js`, `statusBar.js` internals (only prop wiring moves).

## Capabilities

### New Capabilities
- `tui-area-isolation`: The TUI component tree SHALL be split into two isolated subtrees (ConversationArea and InputArea) under a thin App router, such that input keystrokes re-render only InputArea, streaming status updates re-render only InputArea, and new messages re-render only ConversationArea — with zero cross-tree re-renders.

### Modified Capabilities
<!-- None. Existing tui-interface, tui-rendering, tui-streaming, and tui-event-routing
     requirements are behavior-based and remain fully satisfied after the split —
     only the internal component structure changes, not spec-level behavior. -->

## Impact

- **Code:** `src/tui/app.js` (split), `src/tui/conversationArea.js` (new), `src/tui/inputArea.js` (new), `src/tui/index.js` (exports).
- **Behavior:** No user-visible change — streaming, history navigation, scroll, banner, onboarding, and Tab/Escape routing all behave identically.
- **Dependencies:** None added.
- **Testing:** New unit tests for component boundaries and key routing; existing TUI tests must pass unchanged.

## Non-goals

- No virtualization layer (future work, noted in issue).
- No state management library (Zustand/Jotai explicitly rejected).
- No changes to `messageList.js` / `messageBubble.js` internals.
- No new dependencies.
