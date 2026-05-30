## 1. Config Schema

- [x] 1.1 Add `cursorChar` field to `TuiSchema` in `src/config/schemas.js`
- [x] 1.2 Add `blinkTimeout` field to `TuiSchema` in `src/config/schemas.js`
- [x] 1.3 Add `cursorChar` and `blinkTimeout` defaults to `DEFAULT_CONFIG.tui` in `src/config/schemas.js`

## 2. Config File

- [x] 2.1 Add `cursorChar: '█'` to `tui:` section in `config.yaml`
- [x] 2.2 Add `blinkTimeout: 530` to `tui:` section in `config.yaml`

## 3. Blink Component

- [x] 3.1 Create `Blink` sub-component in `src/tui/inputPanel.js` using `useInterval` from Ink
- [x] 3.2 Refactor `InputPanel` to delegate to `Blink`, accepting `blinkTimeout` and `cursorChar` props
- [x] 3.3 Re-export `Blink` from `src/tui/components.js`

## 4. App Wiring

- [x] 4.1 Pass `cursorChar` and `blinkTimeout` from config to `InputPanel` in `src/tui/app.js`

## 5. Tests

- [x] 5.1 Add config schema tests: valid `cursorChar`, valid `blinkTimeout`, defaults, rejects invalid types
- [x] 5.2 Add `DEFAULT_CONFIG.tui` consistency test for new cursor fields
- [x] 5.3 Add Blink component tests: renders with visible cursor, invisible cursor, correct text

## 6. Verification

- [x] 6.1 Run `npm run test` — all tests pass
- [x] 6.2 Run `npm run coverage` — 100% coverage maintained
- [x] 6.3 Run `npm run lint` — no lint errors
