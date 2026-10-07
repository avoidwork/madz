## 1. Config Schema

- [x] 1.1 Add `overscan` to `TuiSchema` in `src/config/schemas/tui.js` as `z.number().int().min(0).default(10)`
- [x] 1.2 Update `config.yaml` line 177, replacing the dead `renderWindow: 100` key with `overscan: 10`

## 2. Height Estimation

- [x] 2.1 Extract the wrapping logic from `getMessages()` in `src/tui/messageList.js` into a pure `estimateMessageHeight(data, width)` function (header row + wrapped lines + reasoning/tool rows)
- [x] 2.2 Reuse `estimateMessageHeight` in the selection map (`getMessages()`) so the estimation and selection logic cannot drift

## 3. VirtualScrollView

- [x] 3.1 Build a `VirtualScrollView` in `src/tui/scrollView.js` that maintains a height map (`id → rows`) using measured heights for mounted bubbles and estimated heights for off-window ones
- [x] 3.2 Compute cumulative offsets and render only the visible range plus the overscan buffer
- [x] 3.3 Use spacer boxes (top/bottom) sized from estimates to preserve the scroll position in estimated coordinate space
- [x] 3.4 Implement real per-item measurement via `useBoxMetrics`, replacing the no-op `remeasureItem`, and correct the height map lazily as items scroll into view
- [x] 3.5 Start bottom-anchored on session restore so a huge history never mounts fully

## 4. Wire overscan Through Component Tree

- [x] 4.1 Thread `config?.tui?.overscan` from `src/tui/app.js` → `ConversationArea` → `ConversationPanel` → `MessageList`, alongside the existing `showToolResults` prop

## 5. Preserve Streaming + Scroll Behavior

- [x] 5.1 Preserve the pub/sub streaming path and `isUserScrolledUpRef` auto-scroll suppression
- [x] 5.2 Ensure a growing bubble reports height via `onHeight` and scroll-to-bottom re-anchors when the user is at the bottom

## 6. Tests

- [x] 6.1 Write unit tests for `estimateMessageHeight` (short, long, reasoning/tool-call messages)
- [x] 6.2 Write unit tests for the visible-range computation as a pure function
- [x] 6.3 Write an integration test confirming only the windowed subset mounts (e.g., via a mount counter)
- [x] 6.4 Run `npm run test`, `npm run lint`, and `npm run coverage`
