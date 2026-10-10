## Context

The TUI status bar (`src/tui/statusBar.js`) currently renders a bare `contextSize` number via `formatSize(contextSize)` in the `showContext` block. The `contextWindow` prop is already available, and `getContextUtilizationColor(contextSize, contextWindow)` already computes the utilization percentage. The conversation view (`src/tui/messageList.js`) renders messages through a virtualized `VirtualScrollView` (`src/tui/scrollView.js`) that exposes an imperative `scrollTo(offset)` API. The `MessageList` exposes `getMessages()` returning `{text, top}` per message, and `MessageBubble` already supports highlighting via a `selection` prop (global char range mapped to a local bubble range through `splitHighlight`).

## Goals / Non-Goals

**Goals:**
- Replace the bare `contextSize` number with a visual context-window utilization meter.
- Add in-conversation search (Ctrl+F) with match highlighting and jump-to-next.

**Non-Goals:**
- No new runtime dependencies.
- No separate search panel.
- No persistence of search state across sessions.
- No change to the `contextSize`/`contextWindow` data flow.

## Decisions

### Decision 1: Meter rendering reuses `getContextUtilizationColor`

The existing `getContextUtilizationColor(contextSize, contextWindow)` already computes the utilization percentage and returns cyan/orange/red. The meter reuses it for coloring. The bar is rendered with block characters (`▮` filled, `▯` empty) and a percentage label. When `contextWindow <= 0`, the meter falls back to the bare `formatSize(contextSize)` number.

**Alternatives considered:** Show only a percentage (no bar) — rejected because a visual bar gives at-a-glance readability. Keep the bare number — rejected because it is not intuitive.

### Decision 2: Search state lives in `MessageList`

`MessageList` owns the message data and the virtualized scroll view. Search state (`searchQuery`, `searchIndex`) and the imperative API (`setSearchQuery`, `clearSearch`, `searchNext`, `searchPrev`) live here. `getMessages()` is reused to find matches and compute scroll targets.

**Alternatives considered:** A separate search panel component — rejected for minimal disruption to the existing scroll view.

### Decision 3: Highlighting reuses the `selection` mechanism

`MessageBubble` already supports highlighting via the `selection` prop (global char range mapped to a local bubble range through `splitHighlight`). Search match highlighting reuses this mechanism by computing local match ranges within each bubble's text and passing them as a `highlights` prop (or reusing `selection`). This avoids duplicating highlight rendering logic.

**Alternatives considered:** A dedicated `highlights` prop with its own rendering — accepted as a cleaner separation from selection, but reuses `splitHighlight`-style logic.

### Decision 4: Regex injection guard

The user query is escaped before building a regex so special characters are treated literally. This prevents regex injection from the search query.

## Risks / Trade-offs

- [Meter width varies with terminal width] → The bar uses a fixed number of block characters (e.g. 6) so it renders consistently regardless of terminal width.
- [Search query with special characters] → Escape the query before building a regex.
- [Empty conversation / no matches] → Handle gracefully: no matches shows a neutral state; empty conversation shows the existing empty message.
- [Search state coordination with input focus] → Ctrl+F toggles search mode and focuses the search input; Escape exits search mode and restores input focus.
- [Scroll offset computation for matched messages] → Use the `offsets` array from `computeVisibleRange` / the `scrollTo` API to jump to the matched message's cumulative offset.
