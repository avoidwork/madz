## Why

Long-running conversations with the ReAct agent accumulate message history that eventually exceeds the LLM provider's context window (e.g., OpenAI), causing API errors that abort the session. The current `context_window_size` setting only trims old exchanges by index, which does not account for variable token consumption when tool calls and responses grow the payload size unpredictably. Users need a way to proactively summarize and compress their conversation history to keep it within the model's context limits without losing the semantic meaning of earlier exchanges.

## What Changes

- Add `:new` command to start a fresh session, clearing the conversation and creating a new UUID session ID
- Add `:compact` command to manually trigger context compaction via the LLM
- Implement `compactConversation()` utility that sends the conversation history to the LLM for summarization, then replaces the full history with a condensed version
- Auto-trigger compaction when the dispatch layer detects a context-window overflow error from the LLM provider
- Persist the compacted conversation as the new state for the session

## Capabilities

### Modified Capabilities
- `session-management`: Add requirements for session compaction (summary-based, not just truncation) and session initialization via `:new`

## Impact

- **Modified files**: `src/session/stateManager.js` (add session init, compaction state tracking), `src/session/window.js` (add compaction function), `src/tui/commandParser.js` (register `:new` and `:compact` commands), `src/tui/app.js` (handle new commands, show system messages)
- **New files**: `src/session/compaction.js` (compaction utility), `tests/unit/session/compaction.test.js`
- **Existing tests**: `tests/unit/session.test.js`, `tests/unit/tui.test.js` need updates
- **Spec**: `openspec/specs/session-management/spec.md` gains new requirements
- **Behavior**: LLM calls may incur an extra summarization round-trip during compaction (manual or error-triggered)
