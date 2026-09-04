## 1. ConversationArea Component

- [ ] 1.1 Create `src/tui/conversationArea.js` — forwardRef component owning `contextSize`, `isCompacting`, and all streaming refs (`messageListRef`, `abortControllerRef`, `isStreamingRef`, `dispatchPromiseRef`, `streamingMsgIdRef`, `tokenCacheRef`, `autoContinueCountRef`, `isAutoContinuingRef`)
- [ ] 1.2 Move conversation handlers into ConversationArea: `handleInterrupt`, `handleCommand`, `handleChat`, `createStreamingHandler`, `finalizeStreaming`, `updateContextSize`, `addMessage`, `handleNewSession`, `shouldAbort`, `getTimestamp`
- [ ] 1.3 Wire status/context/compacting changes through stable App-provided callbacks (`onStatusChange`, `onContextChange`, `onCompactingChange`) instead of local state setters
- [ ] 1.4 Expose imperative handle: `interrupt`, `handleCommand`, `handleChat`, `newSession`, `clear`, `addMessage`, `scrollBy`, `getViewportHeight`, `messageCountRef`
- [ ] 1.5 Maintain `messageCountRef` on every `addMessage`/`clear` so InputArea's StatusBar can read it

## 2. InputArea Component

- [ ] 2.1 Create `src/tui/inputArea.js` — forwardRef component owning `inputText`, `historyIndex`, `chatHistory`, `statusMessage`, `contextSize`, `isCompacting`
- [ ] 2.2 Render StatusBar (reading `messageCount` from the `messageCountRef` prop) and InputPanel inside InputArea
- [ ] 2.3 Implement input-side submit: trim, track in `chatHistory`, reset `historyIndex`, clear input, then call `onSubmit(text)`
- [ ] 2.4 Expose imperative handle: `navigateHistory`, `clearInput`, `getInputText`, `clearHistory`, `setStatusMessage`, `setContextSize`, `setIsCompacting`

## 3. Thin App Router

- [ ] 3.1 Reduce `src/tui/app.js` to cross-cutting state only: `showBanner`, `showOnboarding`, `onboardingResponse`, `inputFocused`
- [ ] 3.2 Create stable callbacks (`onStatusChange`, `onContextChange`, `onCompactingChange`, `onInterruptInput`) that target `inputAreaRef` via optional chaining
- [ ] 3.3 Rewrite `useInput` routing to use `conversationAreaRef`/`inputAreaRef` for interrupt, scroll, and history navigation; keep Tab/Escape/onboarding/banner handling in App
- [ ] 3.4 Move `handleSubmit` to App as a router: interrupt-if-streaming via `conversationAreaRef`, then route to `handleCommand`/`handleChat` on ConversationArea
- [ ] 3.5 Make `handleNewSession` an App-level router calling `conversationAreaRef.current?.newSession()` and `inputAreaRef.current?.clearHistory()`
- [ ] 3.6 Update `processOnboardingInput` to read/clear input text via `inputAreaRef`
- [ ] 3.7 Remove the `areEqual` memo comparator and `React.memo` wrapper from App (no longer needed — App holds no high-frequency state)
- [ ] 3.8 Render ConversationArea and InputArea as sibling subtrees, preserving banner/onboarding layout behavior

## 4. Exports and Wiring

- [ ] 4.1 Update `src/tui/index.js` to export `ConversationArea` and `InputArea`
- [ ] 4.2 Verify `src/tui/app.js` still exports App as default and the entry point in `index.js` (root) is unaffected

## 5. Tests

- [ ] 5.1 Add unit tests for ConversationArea: state ownership, imperative handle methods, messageCountRef updates, status callback wiring
- [ ] 5.2 Add unit tests for InputArea: state ownership, imperative handle methods, input-side submit behavior, StatusBar messageCount from ref
- [ ] 5.3 Add unit tests for thin App: cross-cutting state only, useInput routing to area refs, handleNewSession router, onboarding input via ref
- [ ] 5.4 Verify existing TUI tests still pass (streaming, history navigation, scroll, banner, onboarding, Tab/Escape routing)

## 6. Verification

- [ ] 6.1 Run `npm run test` — all tests pass
- [ ] 6.2 Run `npm run lint` — no lint errors
- [ ] 6.3 Run `npm run coverage` — coverage maintained
- [ ] 6.4 Run `timeout 10 npm start` — application starts without crashing
