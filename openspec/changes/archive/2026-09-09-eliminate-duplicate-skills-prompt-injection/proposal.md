## Why

The orchestrator's system prompt receives two separate skills listings — one from madz's custom `buildSkillsMapping()` and another from deepagents' built-in `SkillsMiddleware.wrapModelCall()`. This duplicates ~50 lines of prompt context on every turn. Additionally, `getSkillPathsForAgent()` returns absolute paths while `getSkillPaths()` returns relative paths, creating inconsistency that would break under `virtualMode: true`.

## What Changes

1. Remove `buildSkillsMapping()` function and its call site from `src/agent/deepAgents.js`
2. Normalize `getSkillPathsForAgent()` in `src/skills/registry.js` to return relative paths

## Capabilities

### New Capabilities

*(none — this is a cleanup/removal)*

### Modified Capabilities

*(none — no spec-level behavior changes)*

## Impact

- `src/agent/deepAgents.js` — ~30 lines removed (function definition + call site)
- `src/skills/registry.js` — 1 line changed, JSDoc updated
- No behavioral change to orchestrator or subagent routing
