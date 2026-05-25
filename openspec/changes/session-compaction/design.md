## Context

The TUI app maintains a conversation history in `sessionState` via `SessionStateManager`. Each user input and assistant response is stored as an exchange. The current `context_window_size` setting (default: 20) trims by exchange count using `enforceContextWindow()`, but this approach assumes a roughly uniform token budget per exchange. When tool calls produce long outputs, or when the model's system prompt is large, the actual token count can far exceed the provider's context window even with only a few exchanges.

OpenAI's API returns a `context_length_exceeded` error with an error code when the total payload (system prompt + conversation messages + tool outputs) exceeds the model's token limit. Currently, this error propagates up to `dispatchProvider` and into the TUI as a failure message, losing all the conversation context.

## Goals / Non-Goals

**Goals:**
- User-initiated `:compact` command that summarizes conversation history via the LLM and replaces the history with a condensed version
- Auto-detection of context overflow errors from the LLM dispatch layer, triggering automatic compaction and re-attempt of the failed message
- `:new` command to start a fresh session while preserving the running app instance
- Compaction preserves semantic context so the agent can continue meaningfully

**Non-Goals:**
- Semantic diff or patch-based merging of compacted contexts
- Auto-compaction on every call (manual + error-triggered only)
- User-configurable compaction strategies (start with simple summarization LLM prompt)
- Real-time token counting during dispatch (no token estimation overhead added)

## Decisions

### 1. Compaction uses the LLM for summarization
**Decision**: `compactConversation()` sends the full conversation history to the same provider/agent, requests a concise summary, and replaces the conversation with a synthetic system-level summary message.

**Rationale**: The LLM is the only thing that understands the conversation domain. A naive truncation loses semantic relationships. Using the LLM itself ensures the compacted context carries forward the same reasoning.

**Alternatives**: Fixed-size sliding window (already exists as truncation), keyword extraction summary (too brittle), no compaction (causes hard failures).

### 2. Compaction inserts a single summary message
**Decision**: After compaction, the conversation history is replaced with a single `{ role: "system", content: "<summary>" }` message, followed by the last N exchanges that didn't fit.

**Rationale**: A single system summary acts like a compressed memory of the full conversation. Keeping the last few recent exchanges preserves immediate context for tool calls and follow-up questions.

**Alternatives**: Replace everything with summary (loses recent context), keep all exchanges and append summary (counter-productive), group exchanges by topic (too complex).

### 3. Auto-trigger compaction on error codes
**Decision**: The dispatch layer checks for known context overflow error codes (`context_length_exceeded`, `maximum_context_length_exceeded`) from the provider. Upon match, it triggers compaction, replaces the conversation, and retries the failed user message.

**Rationale**: Users shouldn't have to manually compact every time. Error-triggered compaction is a safety net. The retry ensures the user's latest message is not silently lost.

**Alternatives**: Poll for token count proactively (adds overhead), only manual compaction (poor UX), always compact before every call (wasteful).

### 4. `:new` resets state in-memory, creates new UUID
**Decision**: `:new` creates a fresh `SessionStateManager` instance with a new `sessionId`, empty conversation, and default context window. It does NOT destroy the agent, tools, or provider config.

**Rationale**: Users may want a clean slate without restarting the entire TUI. The agent config, permissions, and memory system remain unchanged. Only conversation state is reset.

**Alternatives**: Reload the entire app (heavy, loses scheduler state), soft-clear only messages but keep UUID (confusing across tool calls tied to session).

### 5. Compaction is synchronous in TUI
**Decision**: Both manual `:compact` and auto-trigger compaction run synchronously in the dispatch path, showing a `Compacting...` status message during the summarization round-trip.

**Rationale**: Compaction is a short LLM call (a summarization prompt, not a full ReAct agent loop). It blocks the dispatch but completes in seconds. No need for a separate streaming UI for this operation.

**Alternatives**: Background compaction with queued messages (complex state management), user must wait and retry (poor UX).

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Summarization loses important detail or tool result | Keep last N exchanges (default 2-3) after compaction so recent tool results survive |
| Auto-trigger retry causes infinite loop if compaction doesn't reduce tokens enough | Limit auto-retries to 1 additional compaction attempt; if still failing, show hard error |
| `:new` still shares the same agent instance, so agent internal state (memory, tool memory) persists | Document that `:new` only resets conversation state, not agent internal state |
| Compaction LLM call incurs extra cost | Users control `:compact` manually; auto-trigger only fires on error |
| Summary message could be very long for very long conversations | The summarization prompt should instruct the LLM to keep the summary concise (target: under remaining context budget) |

## Migration Plan

No migration needed. This is entirely additive:
1. New commands (`:new`, `:compact`) are opt-in
2. Error-triggered compaction only activates after deployment
3. Existing sessions continue to work with current truncation behavior
4. No schema or API contract changes

After validation, enable auto-trigger by default. If issues arise, auto-trigger can be disabled via a config flag (`session.auto_compact: false`).

## Open Questions

- What is the optimal number of recent exchanges to preserve after compaction? (Default: 2, tunable via config)
- Should the compaction prompt include the system prompt for better summarization accuracy? (Decision: yes, include it)
- How should `:new` interact with the TUI chat history (the `chatHistory` state array used for arrow-key navigation)? -- The chat history buffer should also clear on `:new`
