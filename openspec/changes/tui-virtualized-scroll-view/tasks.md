## 1. Config

- [ ] 1.1 Add `overscan: z.number().int().min(0).default(10)` to `TuiSchema` in `src/config/schemas/tui.js`.
- [ ] 1.2 Replace the dead `renderWindow: 100` key at line 177 of `config.yaml` with `overscan: 10`.

## 2. Height Estimation

- [ ] 2.1 Extract a pure `estimateMessageHeight(data, width)` function from the wrapping logic in `getMessages()` in `src/tui/messageList.js` (header row + wrapped lines + reasoning/tool rows).
- [ ] 2.2 Reuse `estimateMessageHeight` in `getMessages()` for the selection map so the height map and selection map cannot drift.

## 3. VirtualScrollView

- [ ] 3.1 Create `src/tui/virtualScrollView.js` (or extend `scrollView.js`) with a windowed renderer that maintains a height map (`id → rows`).
- [ ] 3.2 Compute cumulative offsets from the height map and render only the visible range plus overscan.
- [ ] 3.3 Use spacer boxes (top/bottom) sized from estimates for off-window regions.
- [ ] 3.4 Implement real per-item measurement via `useBoxMetrics`, replacing the no-op `remeasureItem`.

## 4. Wire overscan through component tree

- [ ] 4.1 Thread `overscan` from `src/tui/app.js` → `ConversationArea` → `ConversationPanel` → `MessageList`, alongside the existing `showToolResults` prop.

## 5. Preserve streaming + scroll behavior

- [ ] 5.1 Keep the pub/sub streaming path and `isUserScrolledUpRef` auto-scroll suppression.
- [ ] 5.2 A growing bubble reports height via `onHeight`; scroll-to-bottom re-anchors when the user is at the bottom.

## 6. Tests

- [ ] 6.1 Write unit tests for `estimateMessageHeight` (pure function).
- [ ] 6.2 Write unit tests for the visible-range computation (pure function).
- [ ] 6.3 Write an integration test confirming only the windowed subset mounts.
- [ ] 6.4 Run `npm run test`, `npm run lint`, and `npm run coverage`.
