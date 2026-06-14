## Context

The Madz agent uses LangGraph's `recursionLimit` parameter to prevent infinite loops in the agent graph. The current default is 30 steps, which is insufficient for complex multi-step tasks involving multiple tool calls and context compaction. Users report the agent stalling mid-task and requiring manual prompting to continue.

## Goals / Non-Goals

**Goals:**
- Increase the default recursion limit to 1000 to prevent premature stalling
- No changes to error handling behavior
- No breaking changes for users with explicit config

**Non-Goals:**
- Changing the error message on recursion limit hit
- Adding new configuration UI or TUI controls
- Implementing adaptive recursion limits based on task complexity

## Decisions

**Decision: Set default to 1000**
- Rationale: The issue reporter suggested 1000. This is still well within safe bounds — LangGraph will still stop the agent if it truly loops. The 30 default was overly conservative for a tool-using agent.
- Alternative considered: 500. Rejected because 1000 provides more headroom for very complex tasks and the cost (token usage) is negligible compared to the benefit (fewer stalls).
- Alternative considered: Make it adaptive. Rejected as unnecessary complexity for a config default.

**Decision: No changes to error handling**
- The existing `GraphRecursionError` handling in `src/agent/react.js` already returns a graceful, actionable message. No improvement needed.

## Risks / Trade-offs

[Risk: Higher token usage per turn] → Mitigation: 1000 steps is still a hard limit. Average tasks use far fewer steps. The trade-off is acceptable.
[Risk: Masking real bugs] → Mitigation: If the agent is truly looping (a bug), it will still stop at 1000. The error message remains the same.

## Migration Plan

This is a config default change with no migration needed. Users with explicit `recursionLimit` in their config are unaffected. New defaults apply immediately on next agent invocation.

## Open Questions

None.
