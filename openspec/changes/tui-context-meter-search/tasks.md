## 1. Context-window meter

- [ ] 1.1 Add a `getContextUtilization` helper in `src/tui/statusBar.js` that computes `contextSize / contextWindow` (0 when `contextWindow <= 0`) and returns the percentage.
- [ ] 1.2 Add a `renderContextMeter` helper that renders a visual bar (e.g. `[▮▮▮▯▯▯] 62%`) using block characters, colored via `getContextUtilizationColor`.
- [ ] 1.3 Replace the `formatSize(contextSize)` render in the `showContext` block of `StatusBar` with the meter, falling back to the bare number when `contextWindow <= 0`.

## 2. Search state in MessageList

- [ ] 2.1 Add `searchQuery` and `searchIndex` state to `MessageList`.
- [ ] 2.2 Add `setSearchQuery`, `clearSearch`, `searchNext`, and `searchPrev` to the imperative API exposed via ref.
- [ ] 2.3 Implement match-finding logic that reuses `getMessages()` to locate matches and compute the scroll target offset.

## 3. Highlight search matches

- [ ] 3.1 Compute local match ranges within each bubble's text when a search query is active.
- [ ] 3.2 Pass the match ranges to `MessageBubble` for highlighting (reuse the `selection`/`splitHighlight` mechanism or add a `highlights` prop).

## 4. Wire Ctrl+F in app.js

- [ ] 4.1 Add a `key.ctrl && input === "f"` branch in the global `useInput` handler in `src/tui/app.js` to toggle search mode.
- [ ] 4.2 Coordinate search mode with the existing `inputFocused` routing so search mode takes precedence.

## 5. Jump-to-next

- [ ] 5.1 Implement `searchNext`/`searchPrev` to advance `searchIndex` and call `scrollRef.current.scrollTo(offset)` using the matched message's cumulative offset.

## 6. Tests

- [ ] 6.1 Add unit tests for the meter (0%, 50%, 100%, and unset contextWindow).
- [ ] 6.2 Add unit tests for search matching/highlighting/jump-to-next.
- [ ] 6.3 Add an integration test simulating Ctrl+F.
- [ ] 6.4 Run `npm run test`, `npm run lint`, and `npm run coverage`.
