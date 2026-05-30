## Why

The chat input panel displays raw typed text with no visual cursor indicator, making it visually unclear where the input ends — especially after streaming responses complete and the message disappears. A blinking cursor provides immediate visual feedback in the input area.

## What Changes

- Add a blinking cursor that appears at the end of the text in the chat input panel
- Cursor character and blink interval are configurable via `config.yaml` under `tui:`
- Cursor character defaults to `█` (Unicode full block, matching the existing streaming cursor)
- Blink interval defaults to 530ms

## Capabilities

### New Capabilities
- `input-cursor`: Blinking cursor visibility toggle in the chat input panel, configurable via TUI settings

### Modified Capabilities
<!-- None – tui-interface covers panel navigation, commands, banners; not cursor behavior -->

## Impact

- `config.yaml` — new keys under `tui:`
- `src/config/schemas.js` — `TuiSchema` and `DEFAULT_CONFIG.tui` entries
- `src/tui/inputPanel.js` — refactored to include `Blink` component using `useInterval` from Ink
- `src/tui/components.js` — re-export of `Blink`
- `src/tui/app.js` — passes `cursorChar` and `blinkTimeout` to `InputPanel`
- `tests/unit/tui.test.js` — config schema tests + Blink component tests
