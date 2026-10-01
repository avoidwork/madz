## Context

The madz TUI (`src/tui/`) renders a conversation and streams model responses. The context window the model sees is the LangGraph checkpointer state (held by the `SqliteSaver` via `agent.updateState`/`agent.getState`) plus the system prompt. The TUI's `ConversationArea` tracks a `contextSize` counter that mirrors the model's context window.

The `readImage` tool returns base64 image data in a ToolMessage. The `imageDispatchMiddleware` (`src/provider/imageDispatchMiddleware.js`) then injects an `image_url` content block into the request. These vision blocks are disproportionately expensive in tokens. As a conversation grows, the context window can balloon toward the model's limit with no manual way to compress it.

The agent (`createDeepAgentsOrchestrator` in `src/agent/deepAgents.js`) exposes `getState(config)` and `updateState(config, values, asNode)` (LangGraph Pregel methods) and sets `agent.contextEstimate` for the TUI's context counter. The TUI currently reaches the agent only via `contextEstimate`; there is no compaction path.

## Goals / Non-Goals

**Goals:**
- Add a `/compact` slash command that manually compresses the context window on demand.
- Remove messages that contain a vision block (base64 image data) — a `readImage` ToolMessage whose content JSON has a non-empty `data` field, and/or messages with `image_url` content blocks.
- Trim/summarize the remaining older messages so the context window is compressed.
- Keep the checkpointer state and `sessionState.getConversation()` in sync so the TUI and model agree.
- Recompute `contextSize` via `updateContextSize` so the status bar reflects the reduced window.

**Non-Goals:**
- Automatic compaction on context-length errors (already handled by the summarization middleware and the `compactContext` tool).
- Changing the `readImage` tool or `imageDispatchMiddleware` behavior.
- Token counting or estimation beyond what `updateContextSize` already does.
- Compaction of the system prompt or memory entries.

## Decisions

### Decision 1: Expose a `compactContext` callback on the agent
**Choice**: Add a `compactContext` function to the agent object returned by `createDeepAgentsOrchestrator`, and thread it through `index.js` → `App` → `ConversationArea`.
**Rationale**: The agent owns the checkpointer state. The compaction routine needs to read the current message state (`agent.getState`), remove vision blocks, and write it back (`agent.updateState`). Exposing a single callback keeps the checkpointer access encapsulated in the agent module and gives the TUI a clean, testable seam.
**Alternatives considered**:
- Thread the raw `agent` into the TUI and call `getState`/`updateState` directly — leaks checkpointer internals into the React layer.
- Implement compaction entirely in the TUI — would require the TUI to reach into the checkpointer, which it cannot do cleanly.

### Decision 2: Compaction routine removes vision blocks and trims older messages
**Choice**: The routine walks the agent's message state, identifies and removes messages that contain a vision block, then trims/summarizes the remaining older messages so the context window is compressed. It returns a result object describing what was removed.
**Rationale**: Vision blocks are the dominant token cost. Removing them first yields the largest reduction. Trimming older messages further compresses the window while preserving recent context.
**Alternatives considered**:
- Only remove vision blocks — may not compress enough for very long conversations.
- Only trim older messages — leaves the expensive vision blocks in place.

### Decision 3: Sync both checkpointer state and sessionState
**Choice**: After compaction, update the checkpointer via `agent.updateState` and update `sessionState.getConversation()` (via `loadConversation`) so the TUI message list and the model's checkpoint agree.
**Rationale**: The TUI renders from `sessionState.getConversation()`, while the model reads from the checkpointer. Both must reflect the compacted state or the TUI and model diverge.
**Alternatives considered**:
- Update only the checkpointer — the TUI would still show the old messages.
- Update only `sessionState` — the model would still see the old checkpoint.

### Decision 4: Recompute contextSize after compaction
**Choice**: After compaction, call `updateContextSize(sessionState, config)` so the status bar reflects the reduced window.
**Rationale**: The status bar's context counter is the user's primary signal that compaction worked. Without recomputing, the counter would show a stale (too large) value.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Removing vision blocks loses image context the model may still need | The `/compact` command is explicit and user-triggered; the user accepts the trade-off by invoking it. Recent non-vision messages are preserved. |
| Trimming older messages loses conversational history | Only older messages beyond a retention window are trimmed; recent messages are preserved. |
| `agent.updateState` requires a valid `asNode` argument | Use the same node name the agent uses for message updates (the orchestrator's message node) or omit it where the API permits. |
| The TUI and checkpointer diverge if one update fails | Wrap the compaction in a try/catch; on failure, report via `onStatusChange` and leave state unchanged. |

## Migration Plan

This is a new feature with no migration required. It is backward compatible — existing conversations and behavior are unchanged until the user invokes `/compact`.

## Open Questions

1. Should `/compact` accept an optional argument (e.g., a target token budget)? (Not for v1 — keep it simple.)
2. Should compaction log the number of removed messages for observability? (Yes, via the existing logger.)
