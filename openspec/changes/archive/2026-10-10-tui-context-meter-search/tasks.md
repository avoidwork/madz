## 1. Context-window meter

- [x] 1.1 Add a `getContextUtilization` helper in `src/tui/statusBar.js` that computes `contextSize / contextWindow` (0 when `contextWindow <= 0`) and returns the percentage.
- [x] 1.2 Add a `renderContextMeter` helper that renders a visual bar (e.g. `[▮▮▮▯▯▯] 62%`) using block characters, colored via `getContextUtilizationColor`.
- [x] 1.3 Replace the `formatSize(contextSize)` render in the `showContext` block of `StatusBar` with the meter, falling back to the bare number when `contextWindow <= 0`.

## 2. Search state in MessageList

- [x] 2.1 Add `searchQuery` and `searchIndex` state to `MessageList`.
- [x] 2.2 Add `setSearchQuery`, `clearSearch`, `searchNext`, and `searchPrev` to the imperative API exposed via ref.
- [x] 2.3 Implement match-finding logic that reuses `getMessages()` to locate matches and compute the scroll target offset.

## 3. Highlight search matches

- [x] 3.1 Compute local match ranges within each bubble's text when a search query is active.
- [x] 3.2 Pass the match ranges to `MessageBubble` for highlighting (reuse the `selection`/`splitHighlight` mechanism or add a `highlights` prop).

## 4. Wire Ctrl+F in app.js

- [x] 4.1 Add a `key.ctrl && input === "f"` branch in the global `useInput` handler in `src/tui/app.js` to toggle search mode.
- [x] 4.2 Coordinate search mode with the existing `inputFocused` routing so search mode takes precedence.

## 5. Jump-to-next

- [x] 5.1 Implement `searchNext`/`searchPrev` to advance `searchIndex` and call `scrollRef.current.scrollTo(offset)` using the matched message's cumulative offset.

## 6. Tests

- [x] 6.1 Add unit tests for the meter (0%, 50%, 100%, and unset contextWindow).
- [x] 6.2 Add unit tests for search matching/highlighting/jump-to-next.
- [x] 6.3 Add an integration test simulating Ctrl+F.
- [x] 6.4 Run `npm run test`, `npm run lint`, and `npm run coverage`.
