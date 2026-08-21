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
  - pattern: ".*"
    agent: general-purpose
```

**Rationale:** Array order is explicit and predictable. Regex patterns are flexible enough for any naming convention. The catch-all `".*"` pattern at the end ensures no skill is ever orphaned.

**Alternatives considered:**
- Object with named keys: Less flexible, no regex support.
- Single string with pipe-delimited patterns: Harder to validate, harder to extend.

### Decision 3: Validation approach

**Choice:** Zod schema in a new `src/config/schemas/skillAgentMap.js` file, imported by `config.js`.

**Rationale:** Consistent with existing config validation pattern. Each config section has its own schema file.

## Risks / Trade-offs

- **Regex injection:** User-provided patterns could be malicious. Mitigation: validate patterns with Zod's `.refine()` to reject patterns with dangerous constructs (e.g., `(?=)`, `(?!)`).
- **Performance:** Pattern matching happens per-skill during discovery. With ~20-30 skills, this is negligible. No caching needed.
- **Breaking change:** If a user adds `skillAgentMap` with a catch-all pattern that differs from the current default (`"orchestrator"`), skills that previously defaulted to orchestrator will now go to the configured agent. This is the intended behavior but could surprise users.

## Migration Plan

1. Add `skillAgentMap` to `config.yaml` with default patterns
2. Add Zod schema and config validation
3. Modify discoverer to inject agent from config
4. Tests verify both frontmatter override and config fallback
5. No migration needed — config is additive, existing skills with `metadata.agent` are unaffected

## Open Questions

- Should the default catch-all pattern be `"general-purpose"` or `"orchestrator"`? The issue description suggests `"general-purpose"` is more correct, but the current code defaults to `"orchestrator"`. I'll use `"general-purpose"` as the default since it's semantically more accurate — skills without an explicit agent assignment should go to the general-purpose agent, not the orchestrator.