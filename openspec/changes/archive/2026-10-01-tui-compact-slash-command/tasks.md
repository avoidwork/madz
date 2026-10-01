## 1. Command Parser

- [x] 1.1 Register a `/compact` command in the dispatch table in `src/tui/commandParser.js` that returns `{ action: "compact" }`
- [x] 1.2 Add `/compact` to the command help list in `src/tui/commandHelp.js`

## 2. Agent Compaction Path

- [x] 2.1 Add a `compactContext` callback to the agent in `src/agent/deepAgents.js` that walks the agent's message state, removes messages containing vision blocks (a `readImage` ToolMessage whose content JSON has a non-empty `data` field, and/or messages with `image_url` content blocks), and trims/summarizes the remaining older messages
- [x] 2.2 Thread the `compactContext` callback from `index.js` into the `App` props

## 3. TUI Conversation Area

- [x] 3.1 Accept the `compactContext` prop in `src/tui/app.js` and thread it into `ConversationArea`
- [x] 3.2 Handle `result.action === "compact"` in `src/tui/conversationArea.js` `handleCommand`, invoking the compaction routine and reporting the result via `onStatusChange`
- [x] 3.3 After compaction, update `sessionState.getConversation()` and recompute `contextSize` via `updateContextSize`

## 4. Tests

- [x] 4.1 Add a test for the `/compact` command in `tests/unit/tui/commandParser.test.js`
- [x] 4.2 Add tests for the compaction routine (vision-block removal, message trimming, context size recompute) in `tests/unit/tui/conversationArea.test.js`
