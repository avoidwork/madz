## Why

The Madz agent frequently "stalls" during complex multi-step tasks, hitting the LangGraph recursion limit and returning a message asking the user to continue. The current default recursion limit is 30 steps, which is insufficient for tasks involving multiple tool calls, context compaction, and complex reasoning chains. Users report that Madz stops working mid-task and requires manual prompting to continue.

## What Changes

- Increase the default `recursionLimit` in the agent configuration from 30 to 1000
- No changes to error handling behavior — the existing graceful message on recursion limit is retained
- No breaking changes for users who explicitly set their own limit

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `agent`: The `agent.recursionLimit` config value is defined within this capability's scope (via `AgentSchema` in `src/config/schemas.js`)

## Impact

- `src/config/schemas.js` — `AgentSchema.recursionLimit` default value
- `tests/unit/config.test.js` — any assertions about the default value
- `tests/unit/react_agent.test.js` — existing recursion limit tests should still pass
- No API or behavioral changes beyond the higher threshold
