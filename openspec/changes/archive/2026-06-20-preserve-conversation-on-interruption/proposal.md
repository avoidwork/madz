## Why

When a user interrupts a conversation (e.g., via escape key, kill signal, or disconnect), the current conversation is permanently deleted rather than being preserved for resumption. This forces the user to start over, losing all context and progress. The root cause is that the TUI layer unconditionally calls `checkpointer.deleteThread(threadId)` in its AbortError handlers, which destroys the conversation checkpoint before the user has a chance to resume.

## What Changes

- Remove the `checkpointer.deleteThread(threadId)` call from AbortError handlers in `src/tui/app.js`
- Preserve conversation checkpoints when interruptions occur, allowing users to resume from the exact point of interruption
- Ensure explicit quit behavior (e.g., `:q` command) still deletes the conversation thread as expected
- Add unit tests covering interrupt/resume scenarios

## Capabilities

### New Capabilities
<!-- No new capabilities being introduced — this is a bug fix -->

### Modified Capabilities
- `tui-conversation`: Changed requirement — conversation checkpoints must be preserved on interruption (AbortError) rather than deleted. Explicit quit behavior remains unchanged.

## Impact

- **Affected code:** `src/tui/app.js` (AbortError handlers at lines ~506-529 and ~906-925)
- **Affected modules:** checkpointer (deleteThread behavior), TUI session management
- **No API changes:** This is an internal behavior fix with no external API impact
- **No dependency changes:** No new or updated dependencies required