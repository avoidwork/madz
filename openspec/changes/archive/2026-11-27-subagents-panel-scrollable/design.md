# Design

## Context

The `SubagentsPanel` (`src/tui/subagentsPanel.js`) renders a `VirtualScrollView` via `scrollRef` and already exposes `scrollBy`, `scrollToBottom`, `scrollToTop`, `getViewportHeight`, and `getBottomOffset` through `useImperativeHandle`. Its only `useInput` handler currently handles `key.escape` to return to conversation. The app-level `useMouseScroll` `onScroll` handler in `src/tui/app.js` returns early when `currentView !== PANELS.CONVERSATION`, so the mouse wheel does not reach the subagents panel. See proposal.md - Why.

## Goals / Non-Goals

- **Goals:** Enable arrow/page-key scrolling inside the subagents panel when it is active, and route the mouse wheel to the subagents panel when it is active.
- **Non-Goals:** No changes to `VirtualScrollView`; no changes to the conversation panel's scroll behavior; no changes to select-mode input-history navigation in the conversation view.

## Decisions

### Arrow/page keys are handled inside the panel's own `useInput`

The app-level comment at `src/tui/app.js` states that panel views defer all input to the active panel via its own `useInput({ isActive })`. The subagents panel already has such a handler for Escape. Extending it to dispatch scroll on `upArrow`/`downArrow`/`pageUp`/`pageDown` keeps input handling co-located with the panel and avoids touching the conversation-view routing block.

- **Alternative considered:** Routing scroll keys at the app level via `routeNavKey`. Rejected because the app-level `routeNavKey` scroll routing sits inside the conversation-view block (after the early return at line 519) and is unreachable for the subagents view. The panel's own handler is the correct, consistent location.

### Scroll deltas mirror `routeNavKey` semantics

Line keys dispatch `scrollBy(±1)`; page keys dispatch `scrollBy(±getViewportHeight())`. This matches the `routeNavKey` semantics in `src/tui/selectMode.js` (pageUp/pageDown always scroll; up/down scroll by one line). The panel is a scrollable list, so up/down always scroll there rather than routing to input history.

### Mouse wheel is routed at the app level

`useMouseScroll` is a single app-level hook, so the wheel must be routed at the app level to the subagents panel via its imperative ref. The `onScroll` handler is modified so that when `currentView === PANELS.SUBAGENTS`, it routes `scaleScrollDelta(delta, config?.tui?.mouseScrollLines || 1)` to `subagentsPanelRef.current?.scrollBy?.(...)`. The conversation-view path and the file-picker guard remain intact; the `onSelect`/`onSelectionChange` handlers still return early for non-conversation views.

## Risks / Trade-offs

- [The panel's `useInput` scroll handling is independent of select mode] → The subagents panel is a scrollable list, not an input, so up/down always scroll there. This is intentional and consistent with the panel being a read-only activity feed.
- [Wheel routing must not regress the conversation path] → The conversation-view branch and file-picker guard are preserved unchanged; only the early-return for `PANELS.SUBAGENTS` is replaced with a route to the subagents panel.

## Migration Plan

No migration. This is a feature addition to the TUI; no data or config changes.

## Open Questions

None.
