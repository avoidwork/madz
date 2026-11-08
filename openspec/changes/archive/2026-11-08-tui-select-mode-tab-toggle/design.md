## Context

`app.js` has one `inputFocused` flag (default true) controlling Tab, key routing, the mouse gate, the link click guard and the `focus` prop. `shouldShowInput` unmounts the TextInput when unfocused.

## Goals / Non-Goals

**Goals:** invert the model with minimal, localized `app.js` edits; keep typed keys from being lost.
**Non-Goals:** changing `useMouseScroll.js`, changing default-mode drag-to-copy, reconciling PR 1686.

## Decisions

- Pure helpers in `src/tui/selectMode.js` (`isPrintableKey`, `routeNavKey`, `isMouseEnabled`, `shouldHandleClick`) so behavior is unit-testable without a TTY; `app.js` only calls them.
- The input stays mounted in select mode with `focus={false}` (ink-text-input ignores keys when unfocused). App-level `useInput` sees a printable key, exits select mode and forwards it via a new `InputArea.appendInput` imperative method. Because the TextInput never handles that key itself while unfocused, it is neither lost nor duplicated. The input is remounted on mode change (key change) so the cursor lands at the end of the text.
- `isPrintableKey` rejects ctrl/meta chords, Escape, Enter, Tab, arrows, paging, backspace/delete, control characters and leftover SGR mouse fragments (`[<b;x;yM`), so no mouse sequence is inserted. Ctrl+r/t/f continue to be swallowed by the existing ink-text-input patch; no new global keys are added.
- Ctrl+F exits select mode; the search input is always focused, so no forwarding is done in search mode.
- Rename `getInputBorderColor` to `getSelectModeBorderColor` and `INPUT_BORDER_CONVERSATION_ACTIVE` to `INPUT_BORDER_SELECT_MODE`.

## Risks / Trade-offs

- Mouse wheel in select mode is terminal-dependent (arrow-key translation vs own scrollback); needs manual verification.
- A multi-character paste in select mode is forwarded whole as one printable string.
- Overlap with PR 1686 on the `app.js` gate.
