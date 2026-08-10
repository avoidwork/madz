## Context

The `src/agent/agents/` directory contains 9 agent definition files, each ~37 lines, following an identical structural pattern:
- 3 imports (`readFile`, `join`, `logger`)
- A unique `load<Prompt>` async function
- An exported agent object (`name`, `description`, `systemPrompt`)
- An async prompt loader call at module initialization

This pattern is repeated across all 9 files with only the prompt filename, agent name, and description differing. The directory name `agents/` inside `agent/` is also confusing.

## Goals / Non-Goals

**Goals:**
- Extract a factory function `createAgentDefinition()` that eliminates boilerplate
- Rename `agents/` → `definitions/` for clarity
- Reduce each agent file from ~37 lines to ~5 lines
- Update all import paths to reference the new location
- Preserve zero behavioral changes

**Non-Goals:**
- Moving `src/agent/backends/` to a separate directory
- Refactoring `agentRegistry.js` or `deepAgents.js` beyond import updates
- Adding or removing agent definitions

## Decisions

**Decision 1: Factory function signature `createAgentDefinition(name, promptFile, description)`**
- Rationale: These three parameters capture all variation between agent files. The prompt file path is always `prompts/<PROMPT_FILE>`, the logger import is always `../../logger.js`, and the agent object shape is fixed.
- Alternative: Pass the full prompt path — rejected because it adds an unnecessary parameter; the `prompts/` prefix is consistent.

**Decision 2: Factory returns the agent object directly (not a class)**
- Rationale: The existing agent files use plain object exports. A factory that returns the same shape ensures zero changes in consuming code.
- Alternative: Use a class — rejected because it would require changes in all consumers and adds unnecessary complexity for a simple data object.

**Decision 3: Async prompt loading preserved in the factory**
- Rationale: The current pattern loads prompts asynchronously at module initialization. The factory replicates this exactly, ensuring no behavioral change.
- Alternative: Load prompts eagerly — rejected because it would change the initialization timing and could cause issues if prompts are not yet available.

**Decision 4: Directory rename via `git mv`**
- Rationale: Using `git mv` preserves history and ensures all references are tracked.
- Alternative: Manual copy/rename — rejected because it loses git history and risks missing import updates.

## Risks / Trade-offs

**Risk:** Import path updates may miss a consumer file.
→ Mitigation: Use `grep -r` to find all references to `src/agent/agents/` before and after the rename, and verify none remain.

**Risk:** The factory function could introduce a circular dependency if `logger` is imported incorrectly.
→ Mitigation: The factory imports logger from `../../logger.js`, same as the current agent files. No change in import depth.

**Risk:** `index.js` export order may affect consumers that rely on ordering.
→ Mitigation: Preserve the existing export order when rewriting `index.js`.

## Migration Plan

1. Create `factory.js` with the factory function
2. Rewrite each agent file to use the factory
3. Update `index.js` imports
4. Rename directory with `git mv`
5. Update all external import references
6. Verify with `npm test` and `npm start`

## Open Questions

None. This is a straightforward structural refactoring with no ambiguous decisions.
