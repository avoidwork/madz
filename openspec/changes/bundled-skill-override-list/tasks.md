# Tasks

## 1. Config Schema & Config Entry

- [ ] 1.1 Add `bundledSkillOverrides: z.array(z.string()).default([])` to `AgentSchema` in `src/config/schemas/agent.js` and verify the schema accepts an array of strings and defaults to `[]` when absent
- [ ] 1.2 Add `bundledSkillOverrides: []` under `agent` in `config.yaml` with a comment that it is only honored when `bundledSkills` is `false`, and verify the config loads without error

## 2. Discoverer Filter

- [ ] 2.1 In `src/skills/discoverer.js`, destructure `bundledSkillOverrides = []` from options and update the `!bundledSkills && bundled` filter to keep `reflection` plus any skill whose name is in the override list; update the JSDoc
- [ ] 2.2 Add unit tests in `tests/unit/skills/discoverer.test.js` covering: `bundledSkills: false` with `bundledSkillOverrides: ["commit-push"]` returns `reflection` + `commit-push`; empty override list returns only `reflection`; `bundledSkills: true` ignores overrides; `reflection` in overrides loads once; non-existent override name ignored

## 3. Registry Pass-Through

- [ ] 3.1 In `src/skills/registry.js`, pass `bundledSkillOverrides` through to `discoverSkills` (defaulting from `config.agent?.bundledSkillOverrides ?? []`) and update the JSDoc

## 4. Documentation

- [ ] 4.1 Document `bundledSkillOverrides` in `docs/CONFIGURATION.md` and `docs/SKILLS.md` and verify the documented behavior matches the implementation

## 5. Verification

- [ ] 5.1 Run `npm run test`, `npm run lint`, and `npm run coverage` and confirm all pass with no regressions
