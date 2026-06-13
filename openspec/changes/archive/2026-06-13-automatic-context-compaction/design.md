## Context

The system uses LangGraph's ReAct agent with a LangChain chat model. The agent invocation happens in `src/agent/react.js` via `callReactAgent` and `callReactAgentStreaming`. The conversation context includes:
- System prompt (loaded from `src/memory/prompts.js`)
- Skill catalog prompt (from registered skills)
- Memory entries (from `src/memory/index.js`)
- Full conversation history stored in LangGraph's checkpointer

The `maxTokens` value from `config.providers.<name>.maxTokens` controls the maximum output tokens but does NOT limit the total input context. When the total context (system prompt + memory + conversation history) exceeds the model's maximum context length, the LLM returns a 400 error.

Currently, this error bubbles up to the TUI or CLI and the user sees a failure with no recovery path.

## Goals / Non-Goals

**Goals:**
- Detect 400 context-length errors from the LLM
- Calculate available token budget from error message + config
- Compact conversation context to fit within budget
- Retry automatically with compacted context
- Expose compaction as a tool the agent can call

**Non-Goals:**
- Token counting or estimation (we work with error-reported max and config values)
- Manual/user-triggered compaction
- Compaction of system prompt or memory entries
- Support for non-OpenAI providers beyond error message pattern matching

## Decisions

### Decision 1: Compaction as a Tool (Not Internal Function)
**Choice**: Implement compaction as a LangChain tool (`compactContext`) that the agent can invoke.
**Rationale**: The user explicitly requested this as a tool. It gives the agent visibility into the compaction process, allows the agent to decide when to compact, and makes the behavior transparent.
**Alternatives considered**:
- Internal function called by `callReactAgent` — less transparent, agent can't control it
- Hybrid: auto-trigger on error but expose as tool — best of both worlds (chosen)

### Decision 2: Tiered Retention Strategy
**Choice**: Three-tier system — always retain, summarize, drop.
**Rationale**: This preserves the highest fidelity information (recent exchanges, tool results) while compressing older history. The tiered approach is more intelligent than a simple "keep last N messages."
**Alternatives considered**:
- Keep last N messages only — too simplistic, loses tool context
- Full summary of entire conversation — loses nuance and tool call details
- Random sampling — unacceptable, loses critical context

### Decision 3: Error Detection via Regex
**Choice**: Use a flexible regex pattern to detect context length errors across providers.
**Rationale**: Different providers phrase errors differently. A regex like `/maximum\s+context\s+length\s+(?:is\s+)?(\d+)\s+tokens/i` catches OpenAI's format. We also handle common variants.
**Alternatives considered**:
- Exact string matching — too brittle across providers
- HTTP status + generic error check — too broad, catches unrelated 400s

### Decision 4: Config-Based Token Budget
**Choice**: `targetTokens = maxContextLength - maxTokens` where maxTokens comes from `config.providers.<name>.maxTokens`.
**Rationale**: The `maxTokens` config value represents the model's output token limit. The available budget for input context is the model's total context length minus this output allocation.
**Alternatives considered**:
- Fixed percentage of maxContextLength — less precise
- Use a separate config field — adds complexity, duplicates information

### Decision 5: Retry Loop in `callReactAgent`
**Choice**: Handle automatic retry in `callReactAgent`/`callReactAgentStreaming`, with the compaction tool available for agent-initiated use.
**Rationale**: This provides automatic recovery (best UX) while still exposing the tool for agent-initiated compaction. The retry loop prevents infinite loops by limiting compaction iterations.
**Alternatives considered**:
- Only agent-initiated compaction — requires the LLM to detect and act on errors, which it may not do reliably
- Only automatic retry — agent has no visibility or control

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Compaction loses critical context | Tiered retention preserves recent messages and tool results; fallback to minimal context if needed |
| Infinite retry loop if compaction can't fit | Limit max compaction iterations (e.g., 3); final fallback to user error message |
| Token budget calculation is inaccurate | The formula `maxContextLength - maxTokens` is an approximation; the retry loop handles over/under-shooting |
| System prompt itself exceeds budget | If even system prompt + last message exceeds budget, return user-facing error |
| Streaming mode error handling differs | Both `callReactAgent` and `callReactAgentStreaming` need error handling; implement consistently |

## Migration Plan

This is a new feature with no migration required. It is backward compatible — existing conversations and error behavior are unchanged until a context-length error occurs, at which point the new compaction flow activates.

## Open Questions

1. Should we log compaction events for observability? (Likely yes, via existing logger)
2. What is a reasonable max compaction iteration count? (Suggested: 3)
3. Should the compaction tool accept an optional "preserve messages" parameter? (Probably not for v1 — keep it simple)
