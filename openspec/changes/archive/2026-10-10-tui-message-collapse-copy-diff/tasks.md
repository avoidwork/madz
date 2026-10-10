## 1. Reasoning Collapse/Expand

- [x] 1.1 Add a collapse/expand toggle for reasoning segments, rendering a single `💭 Thinking…` line when collapsed and the full gray content when expanded.
- [x] 1.2 Toggle the reasoning collapse state with `ctrl+r`.

## 2. Tool Segment

- [x] 2.1 Emit `ToolMessage` text as a `{ type: "tool", text }` event in `index.js`, never folded into `message`.
- [x] 2.2 Handle the `tool` event in `conversationArea.js` by creating a `tool` segment.
- [x] 2.3 Render `tool` segments as a collapsible block in `messageBubble.js`, wired to `toolCallCollapsed`.
- [x] 2.4 Coalesce consecutive tool segments, joined with a blank line.

## 3. Collapse State Lifted to App

- [x] 3.1 Lift `reasoningCollapsed`/`toolCallCollapsed` state to `App`.
- [x] 3.2 Thread the collapse props down through `ConversationArea` → `ConversationPanel` → `MessageList` → `MessageBubble`.
- [x] 3.3 Add the `ctrl+r`/`ctrl+t` key handler in `App`, returning early so the key never reaches the input panel.

## 4. Configurable Initial State

- [x] 4.1 Add `tui.reasoningCollapsed` and `tui.toolCallCollapsed` to the TUI config schema and `config.yaml`, both defaulting to `true`.
- [x] 4.2 Read the initial collapse state from config in `App`.
- [x] 4.3 Document the config options and env var equivalents in README.md.

## 5. Input Panel Patch

- [x] 5.1 Add a `postinstall` patch for `ink-text-input` to swallow `ctrl+r`/`ctrl+t`.

## 6. Banner / Help

- [x] 6.1 Add a "Toggles" section to `COMMAND_GROUPS` (shared by the banner and `/help`).

## 7. Tests

- [x] 7.1 Add unit tests for reasoning collapse/expand toggles.
- [x] 7.2 Add unit tests for tool segment rendering.
- [x] 7.3 Update `shouldRenderBubble`/`estimateMessageHeight` tests for `tool` segments.

## 8. Verification

- [x] 8.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm no regressions.
