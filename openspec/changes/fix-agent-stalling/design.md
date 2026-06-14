## Context

The ReAct agent in `src/agent/react.js` uses LangGraph's `createReactAgentGraph` with a default recursion limit of 25 steps. For complex tasks involving multiple tool calls (read files, run commands, write code, test, commit), 25 steps is easily exhausted. When the agent stalls:

1. The `streamEvents` API completes without emitting any text content events
2. `callReactAgentStreaming` returns `{ content: originalMessage }` — echoing the user's input back
3. The user sees their own message as the "response" and must manually type "continue"

The system prompt already includes a recursion limit message, but this only triggers when `GraphRecursionError` is thrown. Silent stream completion bypasses this.

## Goals / Non-Goals

**Goals:**
- Increase the default recursion limit to 50 to accommodate complex multi-step tasks
- Detect when streaming completes without text output and return a clear error message
- Replace the misleading `originalMessage` fallback with `RECURSION_LIMIT_MESSAGE`

**Non-Goals:**
- Changing the system prompt
- Modifying the TUI components
- Adding new tools or capabilities
- Changing the compaction logic

## Decisions

### Decision 1: Recursion Limit Default = 50
**Rationale:** LangGraph's default of 25 is too low for tasks involving file reads, code writes, tests, commits, and pushes (which can easily take 30-40 steps). 50 provides headroom without being excessive. The value is configurable via `config.agent.recursionLimit`.

**Alternatives considered:**
- 100 — too high, wastes tokens on truly stuck agents
- Keep at 25 — proven insufficient based on user reports

### Decision 2: Track Text Emission in Streaming Loop
**Rationale:** Add a `hasTextContent` boolean flag set to `true` whenever a text event is emitted. At stream completion, check this flag. If `false`, return `RECURSION_LIMIT_MESSAGE` instead of `originalMessage`.

**Alternatives considered:**
- Time-based timeout — adds complexity, doesn't address the root cause
- Count tool calls — unreliable, some tools produce no output

### Decision 3: No Spec-Level Changes
**Rationale:** This is an implementation improvement, not a behavior change from the user's perspective (the agent was already supposed to complete tasks). The existing `cron-scheduler` spec doesn't need modification — the agent's ability to complete tasks is an implementation detail, not a spec requirement.

## Risks / Trade-offs

[Risk] Higher recursion limit increases token usage per turn → [Mitigation] 50 is a modest increase; the agent still stops at the limit. Users can lower it via config if needed.

[Risk] Empty-output detection might trigger on legitimate tool-only responses → [Mitigation] The ReAct agent always produces text after tool execution (reasoning + response). A stream with zero text events indicates the agent stalled before producing any output.

## Migration Plan

This is a code-only change with no migration required. Deploy by merging the PR. The change is backward compatible — existing configs with custom `recursionLimit` values are preserved.

## Open Questions

None.
