## Why

Today the TUI input is focused by default with mouse reporting off, so wheel scroll, click-to-expand and link clicks (issue 1685) only work after pressing Tab. Mouse interaction should be the default; native text selection is the less common need and should be the opt-in mode.

## What Changes

- Replace the `inputFocused` state in `src/tui/app.js` with a `selectMode` flag (default false). Tab toggles it; Ctrl+F search and any printable key exit it.
- Mouse reporting (`useMouseScroll`, `MouseGate`) and the link click handler are enabled when NOT in select mode.
- Key routing: default mode Up/Down = input history, PageUp/PageDown = scroll; select mode Up/Down/PageUp/PageDown = scroll.
- Cyan input border now means select mode; the input stays mounted and visible in select mode; the printable key that exits select mode is appended to the input.
- `TAB_HINT` and `docs/TUI.md` updated. Existing drag-to-copy in default mode is unchanged.

## Capabilities

### New Capabilities
- `tui-select-mode`: Select-mode toggle, mouse gate and per-mode key routing in the TUI.

### Modified Capabilities

## Impact

`src/tui/app.js`, `src/tui/inputArea.js`, `src/tui/inputPanel.js`, `src/tui/banner.js`, new `src/tui/selectMode.js`, `docs/TUI.md`, `docs/TUI_FLOWS.md`, tests. Overlaps with open PR 1686, which also edits the `app.js` mouse gate (`mouseActive`); whichever lands second reconciles. `useMouseScroll.js` is unchanged.
