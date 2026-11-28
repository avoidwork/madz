# Proposal

## Why

The `/subagents` panel does not respond to the mouse scroll wheel or the up/down arrow keys, so users cannot navigate a long list of subagent activity. The conversation panel already supports these interactions, and the subagents panel should behave consistently.

## What Changes

- Extend the `SubagentsPanel` `useInput` handler in `src/tui/subagentsPanel.js` to dispatch `scrollBy` on `upArrow`, `downArrow`, `pageUp`, and `pageDown` when the panel is the active view.
- Route the mouse-wheel scroll in `src/tui/app.js` to the subagents panel when `currentView === PANELS.SUBAGENTS`, instead of returning early.
- Add unit tests covering the panel's scroll-key dispatch and the app-level wheel routing.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tui-subagents-panel`: Add a requirement that the SUBAGENTS panel scrolls via the up/down arrow keys and PageUp/PageDown when it is the active view, dispatching to the virtualized scroll view's `scrollBy` API.
- `tui-mouse-scroll`: Modify the "Mouse events are only handled in the conversation view" requirement so that mouse-wheel scrolling also routes to the subagents panel when it is the active view.

## Impact

- `src/tui/subagentsPanel.js` — extend the `useInput` handler.
- `src/tui/app.js` — route the mouse-wheel scroll to the subagents panel.
- `tests/unit/tui/subagentsPanel.test.js` — add scroll-key dispatch tests.
- `tests/unit/tui/app.test.js` — add wheel-routing tests.

## Non-goals

- No changes to `VirtualScrollView` itself; it already supports relative `scrollBy` and reports `getViewportHeight`/`getBottomOffset`.
- No changes to the conversation panel's existing scroll behavior.
- No changes to select-mode input-history navigation in the conversation view.
