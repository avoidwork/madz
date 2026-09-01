## Context
The deepagents orchestrator (`src/agent/deepAgents.js`) calls `createDeepAgent()` with `model`, `tools`, `systemPrompt`, `store`, `backend`, `subagents`, `skills`, and `checkpointer`. The `middleware` parameter defaults to `[]`.

## Goals
- Enable dynamic subagent execution via `CodeInterpreterMiddleware`
- Minimal code change — one import, one config line
- No changes to existing subagent definitions or skills wiring

## Decisions
- **Use `@langchain/quickjs` v0.6.2+**: Official deepagents QuickJS code interpreter package
- **Drop-in middleware**: No changes to subagent definitions needed — the middleware connects existing subagents to the code interpreter's `task()` global
- **No spec sync needed**: This doesn't modify any existing spec — it adds a new capability

## Risks
- Version compatibility with existing `@langchain` packages
- Potential side effects from middleware initialization (unlikely — it's a pass-through)
