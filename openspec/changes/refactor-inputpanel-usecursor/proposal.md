## Why

The `InputPanel` component renders a cosmetic block character (`█`) as a cursor via a custom `Blink` component. This approach does not control the actual terminal cursor position, lacks IME (Input Method Editor) support, causes visual artifacts, and does not handle wide characters (emoji, CJK) correctly. Ink provides a native `useCursor` hook that solves all of these problems.

## What Changes

- Replace the custom `Blink` component and `█` cursor character in `InputPanel` with Ink's `useCursor` hook
- Compute cursor x position using `stringWidth(prompt + inputText)` for accurate wide character handling
- Compute cursor y position as the last row of the Ink output (below the status bar)
- Hide cursor when input is empty by passing `undefined` to `setCursorPosition`
- Add `string-width` as a production dependency
- Remove `cursorChar` prop from `InputPanel` component API
- Remove `blinkTimeout` config option (no longer needed)

**BREAKING:** The `tui.cursorChar` and `tui.blinkTimeout` config options are removed. The `InputPanel` component no longer accepts a `cursorChar` prop.

## Capabilities

### Modified Capabilities
- `input-cursor`: Replace blinking cosmetic cursor requirements with real terminal cursor requirements via `useCursor` hook
- `tui-cursor-positioning`: Spec already exists with correct requirements — no delta needed

## Impact

- **Files:** `src/tui/inputPanel.js` (primary), `src/tui/app.js` (prop usage), `src/tui/statusBar.js` (layout reference)
- **Dependencies:** Add `string-width` to `package.json`
- **Config:** Remove `tui.cursorChar` and `tui.blinkTimeout` from config schema
- **Tests:** Update existing cursor tests, add tests for wide character positioning and IME support
