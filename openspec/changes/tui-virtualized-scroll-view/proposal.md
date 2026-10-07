## Why

On multi-hour sessions the TUI conversation list accumulates hundreds of `MessageBubble` components, each doing markdown parsing, text wrapping, and ANSI handling. Every new message triggers a full rebuild of the entire children array, and the O(n) `getMessages()` selection map wraps the whole conversation text on each call. This degrades frame rate and increases memory as the session grows.

## What Changes

- Add an `overscan` config value under `tui` in `config.yaml`, replacing the dead `renderWindow: 100` key at line 177, and add `overscan: z.number().int().min(0).default(10)` to `TuiSchema` in `src/config/schemas/tui.js`.
- Extract a pure `estimateMessageHeight(data, width)` function from the wrapping logic in `getMessages()` in `src/tui/messageList.js` (header row + wrapped lines + reasoning/tool rows). Reuse it for both height estimation and the selection map so they cannot drift.
- Build a windowed `VirtualScrollView` (in `src/tui/scrollView.js` or a new module) that maintains a height map (id → rows), computes cumulative offsets, renders only the visible range plus overscan, uses spacer boxes for off-window regions, and implements real per-item measurement via `useBoxMetrics` (replacing the no-op `remeasureItem`).
- Wire `overscan` through the component tree: `src/tui/app.js` → `ConversationArea` → `ConversationPanel` → `MessageList`, alongside the existing `showToolResults` prop.
- Preserve the pub/sub streaming path and `isUserScrolledUpRef` auto-scroll suppression. A growing bubble reports height via `onHeight`; scroll-to-bottom re-anchors when the user is at the bottom.
- Write tests: unit tests for `estimateMessageHeight` and the visible-range computation (pure functions), plus an integration test confirming only the windowed subset mounts.

## Capabilities

### New Capabilities
- `tui-virtual-scroll-view`: Windowed rendering of the conversation message list, maintaining a per-message height map, computing cumulative offsets, and mounting only the visible range plus an overscan buffer.

### Modified Capabilities
- `tui-message-list`: The "Message List Renders All Messages" requirement changes — the list now renders a windowed subset (visible range + overscan) rather than every message, while keeping all messages accessible via scroll.
- `tui-scroll-view`: The ScrollView gains real per-item measurement via `useBoxMetrics` (replacing the no-op `remeasureItem`) and supports windowed rendering with spacer boxes.
- `tui-config`: Add the `tui.overscan` configuration option (non-negative integer, default 10) controlling the number of messages mounted beyond the viewport on each side.

## Impact

- **Modified**: `src/config/schemas/tui.js`, `config.yaml`, `src/tui/messageList.js`, `src/tui/scrollView.js`, `src/tui/messageBubble.js`, `src/tui/conversationPanel.js`, `src/tui/conversationArea.js`, `src/tui/app.js`.
- **New**: `src/tui/virtualScrollView.js` (windowed renderer), `tests/unit/tui/virtualScrollView.test.js`, `tests/unit/tui/messageList.test.js` (extend), `tests/integration/tui/virtualScrollView.test.js`.
- **Dependency**: None new — Ink 8's `useBoxMetrics`, `overflow`, and `contentOffsetY` primitives already provide the needed capabilities.
- **Tests**: `npm run test`, `npm run lint`, `npm run coverage`.

## Non-goals

- No changes to keyboard scroll routing or mouse-wheel scroll handling.
- No changes to the pub/sub streaming path semantics.
- No new npm packages.
- No changes to panel views (skills/memories/settings/sessions/projects).
- No re-enabling terminal-native selection.
