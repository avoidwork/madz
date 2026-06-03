## Why

The TUI currently has a broken input focus model: both `App` and `ConversationPanel` register independent `useInput` hooks, causing navigation keys (arrow keys for history vs. scrolling) to conflict. Additionally, there is no visible indication of which panel is currently active. Users cannot reliably scroll the conversation while also typing, and there is no UI hint showing which panel will receive their next keystroke.

## What Changes

- Centralize all input handling in `App`'s single `useInput` hook
- Gate input handlers behind focus state: input keys (typing, backspace, Enter, history nav) only apply when focus is on the input panel; scroll keys (arrow keys, page Up/Down, Tab, Shift+Tab) only apply when focus is on the conversation panel
- Add Tab/Shift+Tab key handling in `App` to cycle focus between input and conversation panels
- Use cursor visibility as the focus indicator: when focus is on the conversation panel, hide the cursor in the `InputPanel`; when focus is on the input panel, show the cursor (current default behavior)
- Remove the `useInput` hook from `ConversationPanel` — scroll input will be routed from `App`

## Capabilities

### New Capabilities
- `tui-focus-panel`: Panel-level keyboard focus with visible indicator and Tab-based cycling between input and conversation

### Modified Capabilities
- `tui-interface`: Keyboard navigation now supports focus cycling between input and conversation (in addition to the existing multi-panel Tab navigation via commands)

## Impact

- `src/tui/app.js` — Add focus state, Tab handling, conditional key routing, scroll input forwarding
- `src/tui/inputPanel.js` — Accept conditional `cursorChar` prop (undefined when conversation focused)
- `src/tui/conversationPanel.js` — Remove `useInput` hook, accept scroll ref callback
- `src/tui/components.js` — Re-export updated props
- `tests/unit/tui.test.js` — Add focus state and panel navigation tests
- `tests/unit/conversationPanel.test.js` — Update scroll input tests for new routing model
- `openspec/specs/tui-interface/spec.md` — Update keyboard navigation requirement
