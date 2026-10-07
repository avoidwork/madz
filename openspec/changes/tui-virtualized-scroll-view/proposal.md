## Why

On multi-hour sessions the TUI conversation list accumulates hundreds of `MessageBubble` components, each doing markdown parsing, text wrapping, and ANSI handling. Every new message triggers a full rebuild of the entire children array, and the O(n) `getMessages()` selection map wraps the whole conversation text on each call. This degrades frame rate and increases memory as the session grows.

## What Changes

- Introduce a windowed `VirtualScrollView` in `src/tui/scrollView.js` that renders only the visible window plus an overscan buffer, instead of mounting every message bubble.
- Add a configurable `overscan` value under `tui` in `config.yaml`, replacing the dead `renderWindow: 100` key.
- Extract height estimation from `getMessages()` in `src/tui/messageList.js` into a pure `estimateMessageHeight(data, width)` function, reused by both the selection map and the virtual view.
- Thread `overscan` through the component tree: `src/tui/app.js` → `ConversationArea` → `ConversationPanel` → `MessageList`.
- Preserve the pub/sub streaming path and `isUserScrolledUpRef` auto-scroll suppression.

## Capabilities

### New Capabilities
- `tui-virtual-scroll-view`: The TUI conversation panel SHALL render only the visible window of messages plus an overscan buffer, using a height map, cumulative offsets, spacer boxes, and real per-item measurement.

### Modified Capabilities
- `tui-scroll-view`: The ScrollView SHALL support windowed/virtualized rendering with real per-item measurement via `useBoxMetrics`, replacing the no-op `remeasureItem`.
- `tui-message-list`: The MessageList SHALL render only the windowed subset of messages (visible range + overscan) rather than all messages, while preserving pub/sub streaming and auto-scroll suppression.
- `tui-config`: The `tui` config SHALL provide an `overscan` option (non-negative integer, default 10) controlling how many messages are mounted beyond the viewport on each side.

## Impact

- `src/config/schemas/tui.js` — add `overscan` to `TuiSchema`.
- `config.yaml` — replace dead `renderWindow: 100` with `overscan: 10`.
- `src/tui/scrollView.js` — build the windowed `VirtualScrollView`.
- `src/tui/messageList.js` — extract `estimateMessageHeight`; wire the virtual view; preserve streaming + scroll behavior.
- `src/tui/messageBubble.js` — a growing bubble reports height via `onHeight`.
- `src/tui/app.js`, `src/tui/conversationArea.js`, `src/tui/conversationPanel.js` — thread `overscan` through the component tree.
- `tests/unit/tui/` and `tests/integration/` — add unit and integration tests.
- No new npm packages; Ink (v8+) already provides `useBoxMetrics`, `overflow`, and `contentOffsetY`.

## Non-goals

- No change to the data layer or message storage.
- No new external input surface; message content is already validated upstream.
- No change to the mouse-scroll input path beyond preserving `isUserScrolledUpRef` consistency.
