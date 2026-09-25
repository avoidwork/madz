## 1. Schema & Config

- [ ] 1.1 Extend `src/config/schemas/tui.js` with a `statusBar` sub-object containing 7 booleans (`model`, `skills`, `messages`, `context`, `tokens`, `quote`, `version`), each `z.boolean().default(true)`.
- [ ] 1.2 Add the `statusBar` block under the `tui:` section in `config.yaml`.

## 2. StatusBar Component

- [ ] 2.1 Add a `statusBar = {}` prop to the StatusBar component signature in `src/tui/statusBar.js`.
- [ ] 2.2 Gate each of the 7 elements (model, skills, messages, context, tokens, quote, version) on its boolean AND its data presence. Keep the streaming indicator (spinner) always rendered.

## 3. Thread Config

- [ ] 3.1 In `src/tui/inputArea.js`, pass `statusBar` into the StatusBar props.
- [ ] 3.2 In `src/tui/app.js`, pass `statusBar: config?.tui?.statusBar` to InputArea.

## 4. Tests

- [ ] 4.1 Add per-item hiding tests to `tests/unit/tui/statusBar.test.js` (e.g., `statusBar.skills: false` omits the skills element, `statusBar.model: false` omits the model element).

## 5. Verification

- [ ] 5.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm everything passes.
