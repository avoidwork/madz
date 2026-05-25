## 1. Config Schema

- [ ] 1.1 Add `tui` zone to `ConfigSchema` in `src/config/schemas.js` with `name: z.string().default("madz")`.
- [ ] 1.2 Add `tui: { name: "madz" }` to `DEFAULT_CONFIG` in `src/config/schemas.js`.

## 2. Message Label

- [ ] 2.1 Update `getRoleLabel` in `src/tui/messages.js` to accept optional `assistantName` parameter; return it for `"assistant"` role when provided.
- [ ] 2.2 Update `formatMessage` in `src/tui/messages.js` to accept an optional `assistantName` parameter and pass it through to `getRoleLabel`.

## 3. Conversation Panel

- [ ] 3.1 Add `assistantName` prop to `ConversationPanel` in `src/tui/conversationPanel.js` and pass it to `getRoleLabel` calls.
- [ ] 3.2 Update `App` component in `src/tui/app.js` to read `config.tui.name` and pass it to `ConversationPanel`.

## 4. Tests

- [ ] 4.1 Update the `getRoleLabel` test in `tests/unit/tui.test.js` to cover the parameterised `assistantName` behavior (default `"Assistant"` when not provided, custom value when provided).

## 5. Verification

- [ ] 5.1 Run `npm run lint` to verify no lint errors.
- [ ] 5.2 Run `npm run test` to verify all tests pass.
- [ ] 5.3 Run `npm run coverage` to verify 100% coverage is maintained.
