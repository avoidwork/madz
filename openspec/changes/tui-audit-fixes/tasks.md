## 1. Clean up inputPanel.js

- [ ] 1.1 Remove unused `renderBlink` and `getBlinkState` functions and their exports
- [ ] 1.2 Fix `Blink` component: cursor renders in cyan regardless of text color, text color controlled by `cursorColor` prop
- [ ] 1.3 Verify cursor is visible with default colors (white text, cyan cursor)

## 2. Clean up conversationPanel.js

- [ ] 2.1 Remove unused `handleScrollInput`, `handleResize`, `executeScrollInput`, `executeResize`, `executeAutoScroll` functions and their exports
- [ ] 2.2 Move auto-scroll side effects (`scrollToBottom`) from render-phase hash check into a `useEffect` hook watching `messages` and `scrollRef.current`
- [ ] 2.3 Guard `scrollToBottom`, `scrollBy`, `getContentHeight`, `getViewportHeight` calls with `stdout.isTTY` check
- [ ] 2.4 Verify auto-scroll works after new messages and during streaming overflow

## 3. Fix MarkdownText

- [ ] 3.1 Remove `wrap: "hard"` prop from the `Text` component wrapping parsed markdown
- [ ] 3.2 Add `useRef`-based cache for `parseMarkdown` results keyed by content
- [ ] 3.3 Verify markdown renders correctly without double-wrapping on narrow terminals

## 4. Fix MessageBubble dim styling

- [ ] 4.1 Replace `dim: true` with `dimColor: true` in the `Text` component for tool call display lines
- [ ] 4.2 Verify tool call display lines render dimmed in the conversation panel

## 5. Add key prop to InputPanel

- [ ] 5.1 Add a stable `key` prop to `InputPanel` in app.js render
- [ ] 5.2 Verify no React key warnings in console

## 6. Verification

- [ ] 6.1 Run the TUI and verify cursor visibility in all states (focused/unfocused)
- [ ] 6.2 Verify tool call display lines are dimmed
- [ ] 6.3 Verify markdown renders correctly with long content
- [ ] 6.4 Verify no console warnings or errors during normal operation
- [ ] 6.5 Verify no dead code remains (no unused exports)
