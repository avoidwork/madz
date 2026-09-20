# Proposal: Reasoning-only auto-continue

## Why

When an LLM completes a turn with only a reasoning bubble and no message content, the TUI currently leaves the user with a reasoning-only bubble and no actual response. The existing auto-continue mechanism fires only when there is no content at all, and it reuses the same message bubble rather than producing a fresh response. This leaves the conversation stuck when a model ends its turn after thinking.

## What Changes

- **Detect the reasoning-only completion**: After a turn finalizes, if there is committed reasoning but no committed message content, treat it as a reasoning-only completion.
- **Dispatch a silent continue**: Reuse the `handleChat(text, { silentUser: true })` pattern to dispatch a "Please continue." prompt that is added to session state but not rendered as a user message in the TUI.
- **Render the continued response in a fresh bubble**: The continued response streams into a new assistant bubble via a new `addMessage("assistant", "", ...)` call, not by appending to the existing reasoning bubble.
- **Preserve the loop guard**: Keep the `autoContinueCountRef` / `config?.agent?.autoContinueLimit` (default 1000) cap so a model stuck in a reasoning loop is eventually stopped.

## Capabilities

### New Capabilities
- `reasoning-only-auto-continue`: Detects when a turn ends with reasoning but no message content, and dispatches a silent continue prompt so the model produces an actual response.

### Modified Capabilities
- `tui-streaming`: The streaming completion path in `src/tui/conversationArea.js` gains a reasoning-only detection branch that dispatches a silent continue instead of leaving a reasoning-only bubble.

## Impact

- **`src/tui/conversationArea.js`** — the auto-continue block (lines ~304–351) and `finalizeStreaming` (lines ~636–667). The reasoning-only detection and silent continue dispatch live here.
- **`src/tui/messageList.js`** — `addMessage`/`updateMessage` used to create the fresh assistant bubble.
- **`config.yaml` / `src/config/schemas/agent.js`** — `agent.autoContinueLimit` guard preserved.
- **`tests/unit/tui/conversationArea.test.js`** — new unit test coverage for the reasoning-only path.

## Non-goals

- Changing the slash-skill dispatch mechanism itself.
- Altering the reasoning segment rendering in `messageBubble.js`.
- Any changes to the underlying provider/dispatch layer.
