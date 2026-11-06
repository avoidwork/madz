# Tasks

## 1. Add the cyan-bordered box in inputArea.js

- [ ] 1.1 In `src/tui/inputArea.js`, wrap the `InputPanel` (and the `FilePicker`/`CommandPicker`/search `InputPanel`) in a `<Box borderStyle="round" borderColor="cyan" width="100%">`, keeping the existing `paddingX: 1` on the `input-wrapper` Box. Verify by inspecting the JSX structure and confirming the border props are present on the inner Box.

## 2. Add the cyan prompt in inputPanel.js

- [ ] 2.1 In `src/tui/inputPanel.js`, render a cyan `>` prefix before the `ink-text-input` (e.g. a `<Text color="cyan">> </Text>` sibling in a row `Box`), since `ink-text-input` renders no prompt. Verify by inspecting the component and confirming the cyan `>` Text is rendered before the TextInput.

## 3. Preserve the status bar and two-row layout

- [ ] 3.1 Confirm `src/tui/statusBar.js` is not modified and all status bar elements (spinner, model, skill count, message count, context meter, token budget, project, quote, version) remain present and unchanged. Verify with `git diff \-\-stat` showing no changes to `src/tui/statusBar.js`.
- [ ] 3.2 Confirm the two-row layout is preserved (status bar = row 1, bordered input = row 2, no third row). Verify by inspecting the render structure in `src/tui/inputArea.js`.

## 4. Verify

- [ ] 4.1 Run `npm run test` and confirm all tests pass.
- [ ] 4.2 Run `npm run lint` and confirm no lint or formatting errors.
- [ ] 4.3 Run `npm run coverage` and confirm coverage is maintained.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
