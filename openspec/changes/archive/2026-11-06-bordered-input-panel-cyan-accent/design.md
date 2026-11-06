# Design

## Context

See proposal.md - Why. The input panel currently floats unanchored at the bottom of the terminal with no visual boundary. The change is localized to two files in `src/tui/`. The `input-wrapper` Box in `src/tui/inputArea.js` (around lines 245-292) currently sets `paddingX: 1, paddingY: 0`. The `InputPanel` component in `src/tui/inputPanel.js` renders `ink-text-input` directly with no prompt prefix.

## Goals / Non-Goals

**Goals:**
- Wrap the input panel (and the FilePicker/CommandPicker/search InputPanel) in a rounded cyan-bordered box.
- Render a cyan `>` prompt prefix before the text input.
- Preserve the two-row layout and the complete status bar.

**Non-Goals:**
- Modifying `src/tui/statusBar.js`.
- Adding a third row.
- Splitting the status bar into live status vs static info.
- Wrapping the entire bottom area (status + input) in a single bordered container.

## Decisions

### Decision: Add the border in `src/tui/inputArea.js`
The `input-wrapper` Box is the single container that holds the `InputPanel`, the search `InputPanel`, the `FilePicker`, and the `CommandPicker`. Wrapping its contents in a `<Box borderStyle="round" borderColor="cyan" width="100%">` keeps the frame coherent when a picker is open, since all four render inside the same wrapper. The existing `paddingX: 1` on the wrapper is retained.

- **Alternative considered:** Wrap only the `InputPanel` and not the pickers. Rejected — the pickers render inside the same wrapper, so a border around only the input would break the frame when a picker opens.
- **Alternative considered:** Wrap the entire bottom area (status + input) in a single bordered container. Rejected — this changes the status bar's dark-strip treatment.

### Decision: Add the cyan `>` prompt in `src/tui/inputPanel.js`
`ink-text-input` renders no prompt. The `InputPanel` component is the correct place to render a cyan `>` prefix as a `<Text color="cyan">> </Text>` sibling in a row `Box` before the `TextInput`. This keeps the prompt logic co-located with the input component and applies consistently to the normal input, the search input, and the picker inputs.

- **Alternative considered:** Add the prompt as a sibling `<Text>` in the wrapper in `inputArea.js`. Rejected — it would need to be duplicated for each of the four render paths (normal, search, file picker, command picker) and would not be co-located with the input.

### Decision: Follow existing border precedent
`src/tui/onboardingPanel.js` (lines 52-53) already uses `borderStyle: "round"` with a `borderColor`. The same pattern is used here for consistency.

## Risks / Trade-offs

- **The border adds 2 rows of vertical space** (top + bottom). → Mitigation: This is an accepted trade-off per the issue; the two-row layout is preserved and no third row is added.
- **Ink rendering is not exercised by existing tests.** `tests/unit/tui/inputArea.test.js` only tests the imperative API in isolation (no Ink rendering), so adding a border will not break existing assertions. → Mitigation: Verify with `npm run test`, `npm run lint`, and `npm run coverage`.
