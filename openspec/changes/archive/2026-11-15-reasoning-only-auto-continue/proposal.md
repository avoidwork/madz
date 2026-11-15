# Proposal

## Why

Some LLM families (notably certain reasoning models) prematurely end a turn after emitting reasoning, leaving the user with a reasoning-only assistant bubble and no actual answer. The stream consumer classifies and forwards events but does not track the final event type, so the TUI cannot detect this case and the conversation stalls. A prior implementation was removed in PR 1717 because it inferred the condition from accumulated state and reused the same bubble, producing a muddled response.

## What Changes

- Track the last non-subagent stream event type in `consumeStream` (`index.js`) and return it as `lastEventType` in the resolved response.
- Thread `lastEventType` through `runAgent`, `callProvider`, and `dispatchProvider`.
- Add `getLastMessageId()` to the message list imperative API so the TUI can verify which bubble is last.
- In `runTurn` (`conversationArea.js`), after `finalizeStreaming`, dispatch a silent `handleChat("Continue", { silentUser: true })` only when the streaming bubble is the last in the list AND it ended on reasoning AND the loop guard is not exhausted.
- Add `agent.autoContinueLimit` (default 1000) to the config schema and `config.yaml` as a loop guard.

## Capabilities

### New Capabilities

- `tui-streaming`: The TUI streaming path SHALL detect when a turn ends with reasoning as the last event on the last assistant bubble and dispatch a silent "Continue" so the model produces an actual response.

### Modified Capabilities

- `tui-streaming`: Adds a requirement for reasoning-only auto-continue scoped to the last assistant bubble.

## Impact

- **Code**: `index.js` (`consumeStream`, `runAgent`, `callProvider`, `dispatchProvider`), `src/tui/messageList.js` (`getLastMessageId`), `src/tui/conversationArea.js` (`runTurn`).
- **Config**: `src/config/schemas/agent.js` and `config.yaml` (`agent.autoContinueLimit`).
- **Tests**: New `tests/unit/stream/consumeStream.test.js`; extend `tests/unit/tui/conversationArea.test.js` and `tests/unit/tui/messageList.test.js`.
- **Dependencies**: None — pure JavaScript, no new packages.

## Non-goals

- Changing the slash-skill dispatch mechanism.
- Altering reasoning segment rendering in `messageBubble.js`.
- Changes to the underlying provider/dispatch layer beyond threading `lastEventType`.
- Triggering auto-continue for subagent bubbles or clarify resumes.
