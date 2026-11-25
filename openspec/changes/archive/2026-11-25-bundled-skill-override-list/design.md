# Design

## Context

See proposal.md - Why. The `agent.bundledSkills` master switch controls whether bundled `.skills/` skills are loaded. When `false`, only `reflection` is loaded from the `.skills/` scope. This change adds a purely additive `bundledSkillOverrides` list so users can selectively keep specific bundled skills. The existing config loader already supports indexed array env vars via `buildReverseMap` + `syncEnv`, so no loader changes are needed.

## Goals / Non-Goals

**Goals:**
- Add `bundledSkillOverrides` to the `agent` config schema and `config.yaml`.
- When `bundledSkills` is `false`, load `reflection` plus any skill named in the override list from the `.skills/` scope.
- Keep `reflection` reserved and always loaded.
- Pass the option through the registry to the discoverer.
- Document and test the behavior.

**Non-Goals:**
- Changing `bundledSkills` master switch semantics.
- Changing user `skills/` loading.
- Adding per-skill boolean flags.
- Any loader changes (indexed env var support already exists).

## Decisions

- **Schema field**: Add `bundledSkillOverrides: z.array(z.string()).default([])` to `AgentSchema` in `src/config/schemas/agent.js`. This reuses existing Zod validation and defaults to an empty array, so the behavior is unchanged when the option is absent.
- **Config entry**: Add `bundledSkillOverrides: []` under `agent` in `config.yaml` with a comment that it is only honored when `bundledSkills` is `false`.
- **Discoverer filter**: In `src/skills/discoverer.js`, destructure `bundledSkillOverrides = []` from options. Change the `!bundledSkills && bundled` filter from keeping only `reflection` to keeping `reflection` plus any skill whose name is in the override list. This is the single point of behavior change.
- **Registry pass-through**: In `src/skills/registry.js`, pass `bundledSkillOverrides` through to `discoverSkills`, defaulting from `config.agent?.bundledSkillOverrides ?? []`. This keeps the option flowing from config to the discoverer without changing the discoverer's public contract.
- **Alternatives considered**: Always load all bundled skills (rejected — defeats the master switch); per-skill boolean flags (rejected — more verbose, harder to extend); no override mechanism (rejected — leaves all-or-nothing choice).

## Risks / Trade-offs

- [Override naming a non-existent skill] → The filter only keeps skills that exist in the discovered set, so unknown names are silently ignored.
- [`reflection` listed in overrides] → The filter keeps `reflection` unconditionally and deduplicates, so it is loaded exactly once.
- [Overrides present while `bundledSkills` is `true`] → The filter branch only runs when `!bundledSkills`, so overrides are ignored in that case.
