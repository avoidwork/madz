## Why

The agent ("Madz") frequently gets stuck between thoughts without providing output or completion. When this happens, the user must manually prompt "continue" to get the agent to finish. The root cause is twofold: the default LangGraph recursion limit (25 steps) is insufficient for complex multi-step tasks, and the streaming response path silently falls back to echoing the user's input instead of signaling that the agent has stalled.

## What Changes

- Increase the default recursion limit from 25 to 50 in the ReAct agent configuration
- Add text emission tracking in `callReactAgentStreaming` to detect when the stream completes without emitting any text content
- Replace the misleading `originalMessage` fallback with the `RECURSION_LIMIT_MESSAGE` when no text was emitted
- Add unit tests for the empty-output detection path

## Capabilities

### New Capabilities
- **agent-resilience**: Improved agent robustness against silent stalls through better recursion limit defaults and streaming output detection

### Modified Capabilities
- **cron-scheduler**: No spec-level requirement changes — this is an implementation improvement only

## Impact

- `src/agent/react.js` — `callReactAgentStreaming` function (text emission tracking, fallback message)
- `index.js` — `createReactAgent` call with updated default recursion limit
- `config.yaml` — document `agent.recursionLimit` as a configurable value
- `tests/agent/react.test.js` — new tests for empty-output detection
