## Problem
The deepagents orchestrator dispatches subagents one-at-a-time via tool calls. This limits the model's ability to express complex workflows involving loops, branching, and concurrency.

## Solution
Install `@langchain/quickjs` and wire `CodeInterpreterMiddleware` into `createDeepAgent()`. This exposes the `task()` global to the orchestrator model, enabling it to write scripts that drive subagent execution dynamically.

## Impact
- Minimal code change: one import, one config line
- No changes to existing subagent definitions or skills wiring
- No breaking changes to the API surface
