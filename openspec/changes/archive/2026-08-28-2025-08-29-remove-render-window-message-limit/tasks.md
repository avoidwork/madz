# Tasks: Remove renderWindow Message Limit from TUI Message List Panel

## Task 1: Remove renderWindow from config schema

- [x] 1.1: Delete `renderWindow` from `src/config/schemas/tui.js` Zod schema

## Task 2: Remove renderWindow from app.js

- [x] 2.1: Delete the `renderWindow` prop at line 927 in `src/tui/app.js`

## Task 3: Remove renderWindow from ConversationPanel

- [x] 3.1: Destructure and remove the prop at lines 70/78 in `src/tui/conversationPanel.js`
- [x] 3.2: Remove it from the MessageList createElement at line 98
- [x] 3.3: Update JSDoc to remove `@param {number} [props.renderWindow]`

## Task 4: Remove renderWindow from MessageList

- [x] 4.1: Destructure and remove the prop at line 48 in `src/tui/messageList.js`
- [x] 4.2: Replace the slicing logic at lines 372–373 with `idsRef.current.slice()` (no argument = full array)
- [x] 4.3: Remove the `prunedIds` cleanup loop (lines 374–376) since all messages stay in scope
- [x] 4.4: Update JSDoc to remove `@param {number} [props.renderWindow]`
- [x] 4.5: Update comments referencing `tui.renderWindow` in config.yaml

## Task 5: Verify

- [x] 5.1: Run `npm run test` to confirm all tests pass
- [x] 5.2: Run `npm run lint` to confirm no lint errors
- [x] 5.3: Verify app starts without crashing
