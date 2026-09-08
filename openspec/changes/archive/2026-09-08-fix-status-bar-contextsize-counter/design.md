## Context

The TUI's status bar displays a `contextSize` counter that tracks the estimated token usage of the current conversation. This counter is maintained by `updateContextSize()` in `src/tui/conversationArea.js`, which reads the full conversation from `sessionState.getConversation()`, calculates tokens via `calculateConversationTokens`, and updates both the React state and the status bar callback.

Two bugs cause the counter to be inaccurate:

1. **Duplicate user exchange in `handleChat`**: The user message is added to `sessionState` at line 361 (before streaming) and again at line 463 (after streaming), causing the conversation array to contain a duplicate entry. `updateContextSize` at line 480 then counts this inflated conversation.

2. **Missing `updateContextSize` in `handleCommand` skill path**: The skill command path adds the user message (line 202) and assistant response (lines 312-317) to `sessionState` but never calls `updateContextSize` afterward. The context size remains at the streaming approximation (`preStreamContextSize + streaming tokens`), which is stale once streaming completes.

## Goals / Non-Goals

**Goals:**
- Remove the duplicate `sessionState.addExchange` call in `handleChat` (line 463)
- Add `updateContextSize(sessionState, config)` after the user exchange in `handleCommand` skill path (line 202)
- Add `updateContextSize(sessionState, config)` after the assistant exchange in `handleCommand` skill path (after line 317)
- Ensure the context size counter is accurate after both chat and skill command interactions

**Non-Goals:**
- No changes to the token counting algorithm itself
- No changes to the status bar display logic
- No changes to session state management or conversation storage
- No new tests (existing test suite covers the module)

## Decisions

1. **Remove line 463, keep line 361**: The user exchange at line 361 is the correct location — it adds the message before streaming begins, which is necessary for the streaming handler to have access to the full conversation context. Line 463 is a leftover from a previous refactor and serves no purpose.

2. **Fire-and-forget `updateContextSize` calls**: `updateContextSize` is async but does not need to be awaited in the command path. It updates React state and the status bar callback — both can happen asynchronously without blocking the response finalization. This matches the existing pattern in `handleChat` at line 480.

3. **Consistency over optimization**: Adding `updateContextSize` calls in `handleCommand` to match `handleChat` ensures both code paths behave identically with respect to context tracking. This reduces cognitive load for future maintainers.

## Risks / Trade-offs

- **Low risk**: The changes are minimal (one line removed, two lines added) and follow established patterns in the same file.
- **Async timing**: `updateContextSize` is async and may complete after the response is already displayed. This is acceptable — the context size will update shortly after the response appears, which is the same behavior as `handleChat`.
- **No regression risk**: The removed line is pure duplication — removing it cannot break functionality that depends on it, since the same data was already added at line 361.
