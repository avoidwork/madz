## Why

The subagent loader in `src/agent/deepAgents.js` cannot route `openspec-*` skills to the coding agent because these external skills lack `metadata.agent` in their frontmatter. Skills without `metadata.agent` are silently orphaned — they exist in the registry but are never assigned to any subagent. This causes the `scan-issues` → `fix-issue` → `create-feature` pipeline to fail silently when it encounters an `openspec-*` skill, leaving PRs with only OpenSpec files and no implementation code.

## What Changes

- Add a new `skillAgentMap` configuration section to `config.yaml` that maps skill name patterns (regex) to agent types
- Create a `getAgentForSkill()` function in `src/agent/deepAgents.js` that checks frontmatter first, then falls back to config patterns
- Modify the skill loader in `src/skills/discoverer.js` to inject `metadata.agent` from config when frontmatter is missing
- Add config validation for the new `skillAgentMap` structure
- Add unit tests for the mapping function and injection logic

## Capabilities

### New Capabilities

- `skill-agent-mapping`: Configurable regex-based mapping of skill names to agent types via `config.yaml`, with frontmatter override support

### Modified Capabilities

- `skills-registry`: Skills without `metadata.agent` in frontmatter now receive one from config patterns instead of being orphaned
- `subagent`: External skills (e.g., `openspec-*`) can now be routed to appropriate agents without modifying their frontmatter

## Impact

- `config.yaml` — new `skillAgentMap` section
- `src/config/loader.js` — config validation for new section
- `src/agent/deepAgents.js` — new `getAgentForSkill()` function
- `src/skills/discoverer.js` — agent injection before registry push
- `src/skills/registry.js` — no changes needed (injection happens before registry)
- `tests/unit/` — new tests for mapping and injection

## Non-goals

- Changing the subagent routing mechanism itself (DeepAgents integration)
- Adding new agent types
- Modifying existing skill frontmatter files
- Changing the config file format (YAML remains the standard)