## Context

The conversation panel scrolls via the custom `ScrollView` component in `src/tui/scrollView.js`, which exposes `scrollBy(delta)`, `getScrollOffset()`, `getContentHeight()`, `getViewportHeight()`, and `getBottomOffset()` via an imperative ref. It uses Ink 8's `useBoxMetrics` for viewport/content measurement and `contentOffsetY` for scrolling. The `MessageList` component in `src/tui/messageList.js` currently rebuilds the entire children array on every `addMessage`/`clear`/`setMessages` via `renderData.map(...)`, and `getMessages()` wraps the entire conversation text on each call for selection mapping.

On multi-hour sessions this O(n) render path degrades frame rate and memory. The goal is to render only the visible window plus an overscan buffer, while keeping all messages accessible via scroll.

## Goals / Non-Goals

**Goals:**
- Add a configurable `overscan` value under `tui` in `config.yaml` and `TuiSchema`, replacing the dead `renderWindow: 100` key.
- Extract a pure `estimateMessageHeight(data, width)` function from the wrapping logic in `getMessages()` and reuse it for both height estimation and the selection map.
- Build a windowed `VirtualScrollView` that maintains a per-message height map, computes cumulative offsets, renders only the visible range plus overscan, and uses spacer boxes for off-window regions.
- Implement real per-item measurement via `useBoxMetrics`, replacing the no-op `remeasureItem`.
- Wire `overscan` through `app.js` → `ConversationArea` → `ConversationPanel` → `MessageList`.
- Preserve the pub/sub streaming path and `isUserScrolledUpRef` auto-scroll suppression.
- Write unit tests for `estimateMessageHeight` and the visible-range computation, plus an integration test confirming only the windowed subset mounts.

**Non-Goals:**
- No changes to keyboard scroll routing or mouse-wheel scroll handling.
- No changes to the pub/sub streaming path semantics.
- No new npm packages.
- No changes to panel views (skills/memories/settings/sessions/projects).
- No re-enabling terminal-native selection.

## Decisions

### Decision 1: Extract `estimateMessageHeight(data, width)` as a pure function
The wrapping logic in `getMessages()` computes `1 + wrapped.length` (header row + wrapped lines). The new function must also account for reasoning/tool rows. It is extracted into `src/tui/messageList.js` (or a shared module) and reused by both the height map and the selection map so they cannot drift.

**Alternatives considered:**
- Duplicating the logic in two places — rejected: risks drift between the selection map and the height map.
- Inlining in the component — rejected: not unit-testable without mounting React.

### Decision 2: Build `VirtualScrollView` as a new module
A new `src/tui/virtualScrollView.js` module (or extending `scrollView.js`) maintains a height map (`id → rows`), computes cumulative offsets, and renders only the visible range plus overscan. It uses spacer boxes (top/bottom) sized from estimates to preserve scroll position in estimated coordinate space.

**Alternatives considered:**
- Replacing `ScrollView` entirely — rejected: the existing `ScrollView` already provides the imperative scroll API and Ink 8 primitives; the virtualization layer builds on it.
- Tail-window rendering — rejected: breaks scroll-up through a long history.

### Decision 3: Real per-item measurement via `useBoxMetrics`
The existing `remeasureItem` is a no-op. The virtual view implements real per-item measurement so a growing bubble reports its height change via `onHeight`, updating the height map and re-anchoring to the bottom when the user is at the bottom.

### Decision 4: Thread `overscan` through the component tree
`config?.tui?.overscan` flows from `app.js` → `ConversationArea` → `ConversationPanel` → `MessageList`, alongside the existing `showToolResults` prop.

## Risks / Trade-offs

- **[Height estimation drift]** → The pure `estimateMessageHeight` is reused by both the height map and the selection map, so they cannot drift.
- **[Scroll position jump on re-anchor]** → Spacer boxes sized from estimates preserve scroll position; lazy correction re-anchors to the bottom when the user is at the bottom.
- **[Streaming growth during active window]** → A growing bubble reports height via `onHeight`; scroll-to-bottom re-anchors when the user is at the bottom.
- **[Short messages not filling viewport]** → Overscan is per-side, so the mounted set is bounded to roughly `viewport + 2 * overscan`, handling short user messages.
