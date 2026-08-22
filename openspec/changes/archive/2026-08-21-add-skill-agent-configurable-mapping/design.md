## Context

Skills in `madz` are discovered from `skills/` and `.agents/skills/` directories. Each skill's frontmatter may include `metadata.agent` to route it to a specific subagent. Skills without this field are silently orphaned — they appear in the registry but are never assigned to any subagent.

The `openspec-*` skills live in `.opencode/skills/` and cannot have their frontmatter modified (they are external). When `create-feature` invokes `openspec-apply-change`, the skill is not loaded because it lacks `metadata.agent`, causing the pipeline to stall with only OpenSpec files committed and no implementation.

The current code in `deepAgents.js` line 97 defaults skills without `metadata.agent` to `"orchestrator"`, which is incorrect — these skills should be routable to the appropriate agent via a configurable mapping.

## Goals / Non-Goals

**Goals:**
- Add `skillAgentMap` config section with regex patterns mapping skill name patterns to agent types
- Create `getAgentForSkill()` function that checks frontmatter first, then falls back to config patterns
- Inject `metadata.agent` in the discoverer before skills are registered
- Add config validation for the new section
- Add unit tests

**Non-Goals:**
- Changing the subagent routing mechanism itself
- Adding new agent types
- Modifying existing skill frontmatter files
- Changing the config file format (YAML remains the standard)

## Decisions

### Decision 1: Where to inject `metadata.agent`

**Choice:** Inject in `src/skills/discoverer.js` during skill discovery, after parsing frontmatter but before returning the skill object.

**Rationale:** The discoverer is the single point where all skills pass through. Injecting here means the registry receives fully-resolved skills — no downstream code needs to know about the fallback mechanism. This is cleaner than injecting in `deepAgents.js` where it would only affect the orchestrator's view.

**Alternatives considered:**
- Inject in `registry.js` during `register()`: Would require passing config to the registry, adding a dependency.
- Inject in `deepAgents.js` during `buildSkillsMapping()`: Only affects the orchestrator's view, not the registry. Skills would still be "orphaned" in the registry.

### Decision 2: Config structure for `skillAgentMap`

**Choice:** Array of `{ pattern: string, agent: string }` objects, matched in order. First match wins.

```yaml
skillAgentMap:
  - pattern: "^openspec-"
    agent: coding
  - pattern: "^audit-"
    agent: security-audit
```

**Rationale:** Array order is explicit and predictable. Regex patterns are flexible enough for any naming convention. Skills not matched by any pattern are left without `metadata.agent` and fall through to the default `"orchestrator"` in `deepAgents.js`.

**Alternatives considered:**
- Object with named keys: Less flexible, no regex support.
- Single string with pipe-delimited patterns: Harder to validate, harder to extend.

### Decision 3: Validation approach

**Choice:** Zod schema in a new `src/config/schemas/skillAgentMap.js` file, imported by `config.js`.

**Rationale:** Consistent with existing config validation pattern. Each config section has its own schema file.

## Risks / Trade-offs

- **Regex injection:** User-provided patterns could be malicious. Mitigation: validate patterns with Zod's `.refine()` to reject patterns with dangerous constructs (e.g., `(?=)`, `(?!)`).
- **Performance:** Pattern matching happens per-skill during discovery. With ~20-30 skills, this is negligible. No caching needed.
- **Unmatched skills:** Skills not matched by any `skillAgentMap` pattern will not have `metadata.agent` injected. They fall through to the `"orchestrator"` default in `deepAgents.js`, which is the existing behavior — no breaking change.

## Migration Plan

1. Add `skillAgentMap` to `config.yaml` with default patterns
2. Add Zod schema and config validation
3. Modify discoverer to inject agent from config
4. Tests verify both frontmatter override and config fallback
5. No migration needed — config is additive, existing skills with `metadata.agent` are unaffected

## Open Questions

- None. Unmatched skills fall through to the existing `"orchestrator"` default in `deepAgents.js`.