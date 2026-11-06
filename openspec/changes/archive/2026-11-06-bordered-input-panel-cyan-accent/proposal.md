# Proposal

## Why

The input panel currently floats unanchored at the bottom of the terminal with no visual boundary. A bordered frame gives the input a clear "this is where you type" affordance, and cyan matches the existing accent color (the spinner color at low context utilization), so it reads as intentional rather than arbitrary.

## What Changes

- Wrap the TUI input panel in a rounded cyan-bordered box (`borderStyle="round"`, `borderColor="cyan"`, `width="100%"`) in `src/tui/inputArea.js`.
- Render a cyan `>` prompt prefix before the `ink-text-input` in `src/tui/inputPanel.js`, since `ink-text-input` renders no prompt.
- Keep the existing two-row layout: the status bar remains row 1; the bordered input becomes row 2. No third row is added.
- Preserve the complete status bar — all elements (spinner, model, skill count, message count, context meter, token budget, project, quote, version) remain present and unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tui-interface`: The Interactive Chat Mode requirement is extended to specify that the input panel is rendered inside a rounded cyan-bordered box with a cyan `>` prompt prefix, while preserving the two-row layout and the complete status bar.

## Impact

- **Code**: `src/tui/inputArea.js` (wrap the `input-wrapper` Box contents in a bordered Box), `src/tui/inputPanel.js` (add cyan `>` prompt prefix).
- **Not modified**: `src/tui/statusBar.js` — all status bar elements remain present and unchanged.
- **Tests**: `tests/unit/tui/inputArea.test.js` exercises only the imperative API in isolation (no Ink rendering), so adding a border will not break existing assertions. No test changes required for the border itself.
- **Dependencies**: None new. Uses existing Ink `Box`/`Text` components already imported.

## Non-goals

- Adding a third row to the layout.
- Splitting the status bar into live status vs static info.
- Wrapping the entire bottom area (status + input) in a single bordered container.
- Changing the status bar's dark-strip treatment.
- Modifying `src/tui/statusBar.js` in any way.
