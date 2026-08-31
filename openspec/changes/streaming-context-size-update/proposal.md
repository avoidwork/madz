## Why

The TUI status bar's context size display (`[⊣ Xk]`) shows a stale value while the assistant is streaming a response. It only updates after the full response is persisted to session state, leaving the user without feedback on how much context the growing response is consuming. This is a UX gap — the user cannot see real-time context usage during streaming.

## What Changes

- Modify `createStreamingHandler` in `src/tui/app.js` to accept a `preStreamContextSize` parameter and an optional `onContextUpdate` callback.
- During `on_chat_model_stream` events, calculate the token delta for newly accumulated content and update the context size state incrementally.
- Use a delta optimization: calculate tokens only for the new chunk content rather than the full conversation, avoiding expensive full-recalculation during streaming.
- Preserve the post-persistence full recalculation to ensure the final context size is authoritative.
- Add a test verifying context size updates during streaming.

## Capabilities

### Modified Capabilities
- `tui-streaming`: The TUI streaming behavior now updates context size in real-time during content accumulation, not just after persistence.

## Impact

- **Affected code:** `src/tui/app.js` (createStreamingHandler, handleChat, handleCommand), `tests/unit/tui.test.js`
- **No API changes:** All modifications are internal to the TUI component layer.
- **No new dependencies:** Uses existing `calculateConversationTokens` from `src/tui/contextTokens.js`.
- **Performance:** Delta approach avoids full conversation iteration during streaming; only the new chunk content is tokenized.

## Non-goals

- Changes to the token calculation algorithm itself.
- Changes to how system prompt tokens are handled during streaming (system prompt load remains async, deferred to post-persistence).
- Changes to auto-continue logic beyond the streaming handler fix.
- Changes to the status bar component itself (it already accepts a dynamic contextSize prop).
