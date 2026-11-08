## 1. Select-mode state and helpers
- [ ] 1.1 Add `src/tui/selectMode.js` with `isPrintableKey`, `routeNavKey`, `isMouseEnabled`, `shouldHandleClick`.
- [ ] 1.2 Replace `inputFocused` with `selectMode` in `src/tui/app.js`: Tab toggle, Ctrl+F and printable-key exit, per-mode routing, mouse gate, `MouseGate`, click guard.

## 2. Input area
- [ ] 2.1 Rename border helper/constant, keep the input mounted in select mode, add `appendInput`; update `inputPanel.js` docs.

## 3. Hint and docs
- [ ] 3.1 Reword `TAB_HINT`; update `docs/TUI.md` and `docs/TUI_FLOWS.md`.

## 4. Tests and verification
- [ ] 4.1 Update `inputArea.test.js` and `banner.test.js`; add `selectMode.test.js`.
- [ ] 4.2 Run test, lint and coverage.
