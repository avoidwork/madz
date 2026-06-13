## Context

The TUI status bar currently displays `skills:N msg:N` where `msg:N` counts TUI display messages. Users cannot see how many messages are in the actual session conversation, nor do they get visual feedback when the agent compacts the conversation due to context length errors.

## Goals / Non-Goals

**Goals:**
- Display the current session conversation size as `context:N` in the status bar.
- Show `context:N` in red during compaction, returning to default color when complete.
- The display must be reactive — updating immediately when the conversation changes.

**Non-Goals:**
- Changing the compaction algorithm or behavior.
- Adding context window configuration UI.
- Showing token counts (only message counts).
- Non-streaming mode compaction events (not used by TUI).

## Decisions

### Decision 1: Derive context size from `sessionState.getConversation().length`
**Rationale**: The user wants to see the *actual* number of messages in the conversation, not the configured window limit (`getContextWindow()`). The conversation array is the source of truth.

### Decision 2: Emit compaction events via the existing streaming callback
**Rationale**: The streaming callback is already used for text, reasoning, and tool events. Adding two new event types (`compaction_start`, `compaction_end`) follows the established pattern and requires no new infrastructure.

### Decision 3: Update `contextSize` state explicitly after `addExchange()` calls
**Rationale**: Creating a listener system for `sessionState` changes is overkill. The conversation only changes in two places (`handleChat` and `handleNewSession`), so explicit state updates are simpler and more reliable.

### Decision 4: Non-streaming path doesn't emit compaction events
**Rationale**: The non-streaming `callReactAgent` is used only in CLI/chat mode, which doesn't render the TUI status bar. No visual feedback is needed there.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| `sessionState` is null during onboarding/banner | Guard with `sessionState?.getConversation().length ?? 0` |
| Compaction events fire multiple times (up to 3 retries) | `isCompacting` is a boolean — multiple `compaction_start` events are idempotent |
| Race condition: compaction_end before compaction_start | Guard with `if (isCompacting)` before setting to false |
| Context size lags behind actual conversation | Minimal — state is updated synchronously after each exchange |

## Migration Plan

No migration needed. This is a pure UI addition with no API or data changes.

## Open Questions

None.
