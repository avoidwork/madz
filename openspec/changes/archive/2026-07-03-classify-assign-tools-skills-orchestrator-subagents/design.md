## Context

The Madz project uses a Deep Agents architecture where an orchestrator agent delegates tasks to subagents. Currently, `src/agent/deepAgents.js` creates both the orchestrator and subagents with identical tool and skill sets via a single `buildToolConfig()` call. The orchestrator receives all 16 tools (terminal, process, todo, sessionSearch, clarify, webSearch, webExtract, visionAnalyze, imageGenerate, executeCode, cronJob, textToSpeech, mixtureOfAgents, sampling, date, scanAgents) plus all discovered skill paths. This means the orchestrator has access to tools it should never need (like terminal execution or code editing), and subagents don't have differentiated capabilities.

The project uses OpenSpec for feature development. Tools are defined in `src/tools/index.js` with a `TOOL_PERMISSIONS` map and `TOOL_FACTORIES` object. Skills are discovered via `SkillRegistry` in `src/skills/registry.js`.

## Goals / Non-Goals

**Goals:**
- Define a classification schema for tools (orchestrator, subagent, shared)
- Modify `buildToolConfig()` to support filtering by classification
- Update `deepAgents.js` to assign tools based on agent type
- Filter skill paths by agent type (orchestrator gets coordination skills only, subagents get execution skills)
- Maintain backward compatibility — `buildToolConfig()` without a filter includes all tools

**Non-Goals:**
- Adding new tools or skills
- Changing the tool permission system
- Modifying the SkillRegistry or skill discovery mechanism
- Creating new subagent types beyond the existing codingSubAgent
- Runtime reconfiguration of tool assignments

## Decisions

### Decision 1: Classification Map in `src/tools/index.js`
**Choice:** Add a `TOOL_CLASSIFICATIONS` map alongside the existing `TOOL_PERMISSIONS` map.
**Rationale:** Keeps classification co-located with tool definitions. Each tool maps to a classification string. This is simpler than adding a classification field to each factory function.
**Alternatives considered:**
- Adding classification to TOOL_PERMISSIONS values — rejected because it conflates permissions with classification
- Separate classification file — rejected because it creates a second source of truth

### Decision 2: Filter Parameter in `buildToolConfig()`
**Choice:** Add an optional `classificationFilter` parameter (array of strings like `['orchestrator', 'shared']`) to `buildToolConfig()`.
**Rationale:** Optional parameter maintains backward compatibility. When not provided, all tools are included (current behavior).
**Alternatives considered:**
- Boolean `forSubagent` flag — rejected because it doesn't support a third "shared" category
- Separate `buildOrchestratorTools()` and `buildSubagentTools()` functions — rejected because it duplicates the factory logic

### Decision 3: Skill Classification
**Choice:** Classify skills into orchestrator-only, subagent-only, and shared. Initially, no skills are classified for the orchestrator (it has no specialized skills), while all skills are available to subagents.
**Rationale:** The orchestrator's role is coordination — delegation, routing, synthesis. Skills are execution-focused. This can be refined later as new skills are added.
**Alternatives considered:**
- Give orchestrator all skills — rejected because it defeats the purpose of classification
- Hardcode skill assignments per agent — rejected because it duplicates configuration

### Decision 4: Two-Call Pattern in `deepAgents.js`
**Choice:** Call `buildToolConfig()` twice with different filters — once for the orchestrator, once for the codingSubAgent.
**Rationale:** Clear, explicit, and easy to understand. Each agent gets its own tool set.
**Alternatives considered:**
- Build once and clone with filters — rejected because it adds complexity without benefit
- Build a master tool set and filter at agent creation time — rejected because it's less explicit

## Risks / Trade-offs

[Risk] Orchestrator may need a tool that was classified as subagent-only → [Mitigation] Classification can be updated; add a "shared" category for tools both agents need
[Risk] Performance impact from calling `buildToolConfig()` twice → [Mitigation] Negligible — tool creation is lightweight
[Risk] Future subagent types may need different tool sets → [Mitigation] The classification system supports this; add new subagent types with appropriate filters
[Risk] Breaking changes if classification is wrong → [Mitigation] Add tests to verify each agent has expected tools

## Migration Plan

1. Add `TOOL_CLASSIFICATIONS` map to `src/tools/index.js`
2. Modify `buildToolConfig()` to accept `classificationFilter` parameter
3. Update `deepAgents.js` to use two calls with appropriate filters
4. Update `docs/OVERVIEW.md` to document the new architecture
5. No rollback needed — change is additive and backward compatible

## Open Questions

- Should the orchestrator have any skills at all, or should all skills be subagent-only?
- Are there any tools that should be "shared" (available to both agents)?
- How should classification be documented for future tool additions?