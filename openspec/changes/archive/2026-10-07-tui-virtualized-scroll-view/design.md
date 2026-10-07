## Context

The TUI conversation panel (`src/tui/messageList.js`) currently renders the entire children array on every `addMessage`/`clear`/`setMessages` via `renderData.map(...)`. On multi-hour sessions this mounts hundreds of `MessageBubble` components, each doing markdown parsing, text wrapping, and ANSI handling. The `getMessages()` selection map also wraps the entire conversation text on each call — an O(n) cost.

The existing `ScrollView` (`src/tui/scrollView.js`) already provides the imperative scroll API (`scrollBy`, `scrollToBottom`, `getBottomOffset`, `getContentHeight`, `getViewportHeight`) and uses Ink 8's `useBoxMetrics` + `contentOffsetY`. Its `remeasureItem` is currently a no-op kept for API compatibility.

## Goals / Non-Goals

**Goals:**
- Render only the visible window of messages plus an overscan buffer, bounding the mounted set to roughly `viewport + 2 * overscan`.
- Maintain a height map (`id → rows`) using measured heights for mounted bubbles and estimated heights for off-window ones.
- Compute cumulative offsets and render only the visible range plus overscan, using spacer boxes for off-window regions.
- Preserve the pub/sub streaming path and `isUserScrolledUpRef` auto-scroll suppression.
- Extract height estimation into a pure, testable `estimateMessageHeight(data, width)` function.

**Non-Goals:**
- No change to the data layer or message storage.
- No new external input surface.
- No change to the mouse-scroll input path beyond preserving `isUserScrolledUpRef` consistency.

## Decisions

### Decision 1: Build the virtual view on top of the existing `ScrollView`, not replace it

The existing `ScrollView` already provides the imperative scroll API and uses Ink 8's `useBoxMetrics` + `contentOffsetY`. Rather than replace it, we extend it with a windowed renderer. The `ScrollView` keeps its imperative scroll methods; a new `VirtualScrollView` (in `src/tui/scrollView.js`) adds the height map, cumulative offsets, visible-range computation, and spacer boxes.

**Alternatives considered:**
- Replace `ScrollView` entirely — rejected because the imperative API is already wired through `messageListRef` and `app.js` keyboard/mouse handlers.
- Keep the current full render — rejected because the performance wall on multi-hour sessions remains.

### Decision 2: Extract `estimateMessageHeight(data, width)` as a pure function

The wrapping logic in `getMessages()` (header row + wrapped lines + reasoning/tool rows) is extracted into a pure `estimateMessageHeight(data, width)` function. It is reused by both the selection map and the virtual view's height estimation so they cannot drift.

**Alternatives considered:**
- Inline the estimation in the virtual view — rejected because it duplicates the selection-map wrapping logic and risks drift.

### Decision 3: Real per-item measurement via `useBoxMetrics`

The no-op `remeasureItem` is replaced with real per-item measurement. Each mounted bubble reports its measured height via `onHeight` (a new callback), which updates the height map and re-anchors the scroll position when the user is at the bottom. This preserves streaming growth without a full parent re-render.

**Alternatives considered:**
- Keep the no-op `remeasureItem` — rejected because a growing bubble would leave the height map stale and break scroll anchoring.

### Decision 4: `overscan` is configurable, defaulting to 10

`overscan` is the number of messages mounted beyond the viewport on each side. It is a non-negative integer, defaulting to 10, added to `TuiSchema` and `config.yaml`. This handles short user messages that don't fill the viewport.

**Alternatives considered:**
- Tail-window rendering (render only the last N messages) — rejected because it breaks scroll-up through a long history.
- Fixed total window cap — rejected because it's fragile when messages are short (1-2 rows) and won't fill the viewport.

## Risks / Trade-offs

- **[Height estimation drift]** → The pure `estimateMessageHeight` is reused by both the selection map and the virtual view, so they cannot drift.
- **[Stale height map during streaming]** → Real per-item measurement via `useBoxMetrics` + `onHeight` updates the height map lazily as items scroll into view, re-anchoring to the bottom when the user is at the bottom.
- **[Scroll position jump when items re-measure]** → Spacer boxes sized from estimates preserve the scroll position in estimated coordinate space; the height map corrects lazily as items scroll into view.
- **[Auto-scroll suppression regression]** → `isUserScrolledUpRef` is preserved; a growing bubble reports height via `onHeight` and scroll-to-bottom re-anchors only when the user is at the bottom.

## Migration Plan

1. Add `overscan` to `TuiSchema` and `config.yaml`.
2. Extract `estimateMessageHeight`.
3. Build `VirtualScrollView` with height map, cumulative offsets, visible-range + overscan rendering, spacer boxes, and real per-item measurement.
4. Wire `overscan` through `app.js` → `ConversationArea` → `ConversationPanel` → `MessageList`.
5. Preserve streaming + scroll behavior.
6. Write unit + integration tests; run `npm run test`, `npm run lint`, `npm run coverage`.

Rollback: revert the feature branch and close the PR; the change is confined to the TUI render layer.

## Open Questions

None — the issue body and audit findings fully specify the requirements.
