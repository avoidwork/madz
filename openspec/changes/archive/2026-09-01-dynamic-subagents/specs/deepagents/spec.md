## What
Enable dynamic subagent execution by wiring `CodeInterpreterMiddleware` from `@langchain/quickjs` into the deepagents orchestrator's `createDeepAgent()` call.

## Why
The existing subagent system dispatches agents one-at-a-time via tool calls. Dynamic subagents let the model write scripts that drive subagent execution, enabling loops, branching, and concurrency — patterns that tool-call-based orchestration can't reliably deliver at scale.

## Changes
### src/agent/deepAgents.js
- Add import: `import { CodeInterpreterMiddleware } from "@langchain/quickjs";`
- Add `middleware: [CodeInterpreterMiddleware]` to the `createDeepAgent()` call

### package.json
- Add `@langchain/quickjs` v0.6.2+ as a dependency

## Out of Scope
- Changes to subagent definitions (`subagentDefinitions`)
- Changes to skills wiring (`skillPaths`)
- Any changes to the middleware's internal behavior — it is a drop-in from the library

## Testing
- Unit test: Verify `CodeInterpreterMiddleware` is imported and passed in the `middleware` array
- Integration test: Trigger a workflow via the orchestrator and verify the model can write and execute a script that dispatches subagents

## Security
- `CodeInterpreterMiddleware` from `@langchain/quickjs` handles sandboxing natively — scripts run in an isolated QuickJS VM with no filesystem, network, or process access
