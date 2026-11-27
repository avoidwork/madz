# Tasks

## 1. Subagents panel scroll-key handling

- [ ] 1.1 Extend the `SubagentsPanel` `useInput` handler in `src/tui/subagentsPanel.js` to dispatch `scrollBy` on `upArrow`/`downArrow` (line, ±1) and `pageUp`/`pageDown` (page, ±getViewportHeight()), preserving the existing Escape-to-conversation behavior, and verify the panel's scroll-key dispatch tests pass.

## 2. Mouse-wheel routing

- [ ] 2.1 Modify the `useMouseScroll` `onScroll` handler in `src/tui/app.js` so that when `currentView === PANELS.SUBAGENTS` it routes `scaleScrollDelta(delta, config?.tui?.mouseScrollLines || 1)` to `subagentsPanelRef.current?.scrollBy?.(...)`, keeping the conversation-view path and file-picker guard intact, and verify the app-level wheel-routing tests pass.

## 3. Tests

- [ ] 3.1 Add unit tests in `tests/unit/tui/subagentsPanel.test.js` covering the panel's `useInput` dispatching `scrollBy` in the correct direction for `upArrow`, `downArrow`, `pageUp`, and `pageDown`, and verify they pass.
- [ ] 3.2 Add unit tests in `tests/unit/tui/app.test.js` covering the app-level wheel routing to the subagents panel when `currentView === PANELS.SUBAGENTS`, and verify they pass.

## 4. Verification

- [ ] 4.1 Run `npm run test`, `npm run lint`, and `npm run coverage` and verify no regressions.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
