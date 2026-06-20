## Context

The agent module (`src/agent/react.js`) is the core inference engine for the madz application. It handles both synchronous and streaming calls to the LangGraph React agent, manages LLM response caching, conversation compaction, and content extraction from agent results. A recent code audit identified three issues in this file: a high-severity bug in streaming response handling, a medium-severity bug in message type detection, and a low-severity performance issue.

## Goals / Non-Goals

**Goals:**
- Fix streaming responses to return aggregated AI text instead of the original user query
- Add comprehensive message type detection supporting all LangChain message types
- Eliminate unnecessary array allocations in message iteration

**Non-Goals:**
- Changes to non-streaming `callReactAgent` return behavior
- Changes to message handling logic beyond type detection
- Changes to other modules or external dependencies
- Migration or deployment procedures (this is a straightforward code fix)

## Decisions

### Decision 1: Return `aggregatedText || originalMessage` instead of just `aggregatedText`
**Rationale:** Preserves existing fallback behavior for edge cases (empty streams, errors) while correctly returning the AI response on the happy path. This is a minimal, safe change that fixes the bug without altering the contract.

### Decision 2: Extract message type detection into `getMessageRole()` helper
**Rationale:** Two call sites had identical inline type detection logic. Extracting to a shared helper eliminates duplication, makes it easy to add new message types in the future, and ensures consistency. The fallback to "system" for unknown types prevents silent data loss during conversation compaction.

### Decision 3: Replace `[...msgsArray].reverse().find()` with reverse for-loop
**Rationale:** The spread + reverse + find pattern creates three O(n) operations (copy, reverse, iterate). A single reverse for-loop achieves the same result with O(n) time and O(1) extra space. This is a purely mechanical refactoring with identical semantics.

## Risks / Trade-offs

- **[Risk]** Streaming behavior change could affect downstream consumers expecting the original message
  **Mitigation:** The original behavior was incorrect (returning user query instead of AI response). The fallback to `originalMessage` when no text events occurred preserves the previous behavior for edge cases.

- **[Risk]** Adding ToolMessage import could fail if the LangChain version doesn't export it
  **Mitigation:** ToolMessage has been part of `@langchain/core/messages` since early v0.x releases. The project uses `^10.3.1` of pino (latest), and LangChain is a core dependency that is kept up to date.

## Migration Plan

No migration needed. This is a code-only fix with no configuration changes, database migrations, or deployment steps. The fix can be deployed immediately after the PR merges.

## Open Questions

None. All three audit findings have clear, well-understood fixes.