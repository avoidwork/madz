## Context

The ReAct agent in `src/agent/react.js` uses conversation compaction to handle context length limits. When a conversation exceeds the token limit, `compactConversation` is called and the resulting compacted messages are rebuilt into LangChain message instances. The rebuild logic currently handles "system" and "user" roles but falls through to `AIMessage` for all other roles, including "tool". This causes ToolMessage instances (which contain tool execution results) to be lost, breaking the agent's ability to continue conversations that depend on prior tool outputs.

## Goals / Non-Goals

**Goals:**
- Preserve ToolMessage instances during conversation compaction in both `callReactAgent` and `callReactAgentStreaming`
- Ensure tool results are correctly reconstructed using `new ToolMessage(m.content)`

**Non-Goals:**
- Changes to the compaction algorithm itself
- Changes to other message types (FunctionMessage, etc.)
- Changes to other agents or the compaction utility

## Decisions

1. **Add explicit "tool" case in rebuild logic** — Rather than using a generic fallback, add an explicit case for `m.role === "tool"`. This is more maintainable and makes the intent clear.

2. **Use `new ToolMessage(m.content)`** — ToolMessage is already imported and used elsewhere in the file. The content field is the primary field needed for reconstruction.

3. **Apply fix to both functions** — Both `callReactAgent` and `callReactAgentStreaming` have identical rebuild logic. Both must be fixed to maintain consistency.

## Risks / Trade-offs

- **Risk:** ToolMessage may have additional fields beyond `content` that are not preserved. **Mitigation:** The compacted message structure only includes `role` and `content` fields, so this is the best we can do without changing the compaction format.
- **Risk:** Other message types (e.g., FunctionMessage) may have the same issue. **Mitigation:** Out of scope for this fix. Can be addressed in a follow-up if needed.

## Migration Plan

No migration needed. This is a code-only fix that will take effect immediately on the next deployment.

## Open Questions

- Should we also handle FunctionMessage and other message types in a follow-up?
- Does the compaction format need to be extended to preserve additional ToolMessage fields?