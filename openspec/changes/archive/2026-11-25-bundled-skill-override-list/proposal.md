# Proposal

## Why

The `agent.bundledSkills` master switch (default `true`) controls whether bundled `.skills/` skills are loaded. When set to `false`, only the `reflection` skill is loaded from the `.skills/` scope. This is all-or-nothing: a user who wants to disable the bulk of bundled skills has no way to keep a specific one. The override list fills that gap, giving per-skill control without reintroducing the full bundled set.

## What Changes

- Add a `bundledSkillOverrides` array under `agent` in `config.yaml` (default empty array), populated via indexed env vars (`AGENT_BUNDLED_SKILL_OVERRIDES_0=review-code`, etc.).
- Add `bundledSkillOverrides: z.array(z.string()).default([])` to `AgentSchema` in `src/config/schemas/agent.js`.
- Update the `!bundledSkills && bundled` filter in `src/skills/discoverer.js` so the bundled `.skills/` scope loads `reflection` plus any skill named in the override list.
- Update `src/skills/registry.js` to pass `bundledSkillOverrides` through to `discoverSkills`.
- Document the new option in `docs/CONFIGURATION.md` and `docs/SKILLS.md`.
- Add unit tests for the override behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skills-registry`: The bundled `.skills/` scope loading behavior changes so that when `bundledSkills` is `false`, the scope loads `reflection` plus any skill named in `bundledSkillOverrides`. `reflection` remains reserved and always loaded. User skills in `skills/` are unaffected, and the override list is purely additive (only honored when `bundledSkills` is `false`).

## Impact

- `src/config/schemas/agent.js` — add schema field.
- `config.yaml` — add config entry.
- `src/skills/discoverer.js` — update bundled filter.
- `src/skills/registry.js` — pass option through.
- `docs/CONFIGURATION.md`, `docs/SKILLS.md` — documentation.
- `tests/unit/skills/discoverer.test.js` — new tests.
- No new npm packages; no loader changes (indexed env var support already exists).

## Non-goals

- Not changing the `bundledSkills` master switch semantics.
- Not changing user `skills/` loading behavior.
- Not changing `reflection` reserved behavior.
- Not adding per-skill boolean flags in config.
