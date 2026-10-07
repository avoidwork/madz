## 1. Dependency

- [x] 1.1 Add `clipboardy` (v4.x+) to `package.json` dependencies and install it.

## 2. Extend Mouse Hook

- [x] 2.1 Extend `src/tui/useMouseScroll.js` to add `\x1b[?1002h` to the enable sequence and `\x1b[?1002l` to the disable sequence.
- [x] 2.2 Add a `buttonToSelection()` helper that returns `true` for button 0 (left-button drag) and `false` otherwise.
- [x] 2.3 Track selection state in the hook: on left-button press (button 0), record the start `(x, y)`; on move while held, update the end; on release, finalize and invoke a new `onSelect` callback with the start/end coordinates.
- [x] 2.4 Keep wheel events (button codes 64/65) invoking `onScroll` and left-button drag (button 0) invoking `onSelect`, disjoint from each other.

## 3. Coordinate-to-Character Mapping

- [x] 3.1 Create `src/tui/selectionLayout.js` with a pure function that maps `(x, y)` coordinates to a character range, using terminal width, scroll offset, and each message's plain text plus wrapped-line structure.
- [x] 3.2 Add the scroll offset from `getScrollOffset()` to the mouse `y` coordinate before mapping.
- [x] 3.3 Clamp selections that start or end outside the message area to the rendered layout bounds.

## 4. Clipboard Copy

- [x] 4.1 On selection finalize, extract the selected substring and write it to the clipboard via `clipboardy.write()`.
- [x] 4.2 Handle clipboard write failures gracefully (best-effort, no crash).

## 5. Selection Highlight

- [x] 5.1 Pass the selected character range down to `messageBubble.js` / `markdownText.js`.
- [x] 5.2 Render the selected character range with inverse video or a background style.
- [x] 5.3 Clear the highlight on release.

## 6. Wire into App

- [x] 6.1 In `src/tui/app.js`, pass the selection callback to `useMouseScroll`, gated by the same conditions as scroll (conversation view, file picker closed).

## 7. Tests

- [x] 7.1 Extend `tests/unit/tui/useMouseScroll.test.js` for drag-move parsing, button classification (wheel vs left-button), and press/release/drag-move events.
- [x] 7.2 Add `tests/unit/tui/selectionLayout.test.js` for coordinate-to-character mapping, including multi-line wrapping, out-of-bounds clamping, and empty selection.
- [x] 7.3 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm everything passes.
