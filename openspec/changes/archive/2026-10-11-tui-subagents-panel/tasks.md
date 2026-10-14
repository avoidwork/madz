## 1. Capture the namespace in callProvider

- [x] 1.1 In `index.js` `callProvider`, capture `_namespace` from the `agent.stream()` iteration and emit `subagent_message`/`subagent_reasoning`/`subagent_tool_start`/`subagent_tool_end` events carrying the namespace when `namespace.length > 0`
- [x] 1.2 Keep the root graph (empty namespace) emitting the existing `message`/`reasoning`/`on_tool_start`/`on_tool_end` event types unchanged

## 2. Route subagent events in the TUI

- [x] 2.1 In `src/tui/conversationArea.js` `createStreamingHandler`, handle `subagent_message`, `subagent_reasoning`, `subagent_tool_start`, `subagent_tool_end` by routing them to a dedicated subagent store keyed by namespace, not `streamingMsgIdRef.current`

## 3. Add the SUBAGENTS panel

- [x] 3.1 Add `SUBAGENTS` to `PANELS` in `src/tui/panels.js` and register it in `getPanelOrder()`
- [x] 3.2 Create `src/tui/subagentsPanel.js` rendering each subagent's reasoning/message segments and tool calls, reusing `MessageBubble` or a variant

## 4. Wire the panel into App

- [x] 4.1 Add a `currentView === PANELS.SUBAGENTS` branch in the App render switch (`src/tui/app.js`) rendering the new panel, passing the subagent store

## 5. Write unit tests

- [x] 5.1 Add `tests/unit/tui/subagentsPanel.test.js` covering namespace discrimination, event routing, and tool-call redirection

## 6. Verify

- [x] 6.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm everything passes
