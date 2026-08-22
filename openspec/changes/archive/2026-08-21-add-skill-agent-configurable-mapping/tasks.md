## 1. Config Schema

- [ ] 1.1 Create `src/config/schemas/skillAgentMap.js` with Zod schema for `skillAgentMap` array entries (pattern: string, agent: string, regex validation)
- [ ] 1.2 Import and add `SkillAgentMapSchema` to `ConfigSchema` in `src/config/config.js`
- [ ] 1.3 Add default `skillAgentMap` entries to `DEFAULT_CONFIG` in `src/config/config.js` (openspec→coding, audit→security-audit)
- [ ] 1.4 Add `skillAgentMap` entries to `config.yaml` with the same defaults

## 2. Discoverer Agent Injection

- [ ] 2.1 Create `src/skills/agentMapper.js` with `getAgentForSkill(skillName, config)` function that checks frontmatter first, then falls back to config patterns
- [ ] 2.2 Modify `src/skills/discoverer.js` to import config and call `getAgentForSkill()` after parsing frontmatter but before pushing the skill
- [ ] 2.3 Ensure `metadata.agent` is injected into the skill object before it's added to the registry

## 3. Tests

- [ ] 3.1 Create `tests/unit/skills/agentMapper.test.js` with tests for: frontmatter override, config fallback, no config fallback, invalid regex rejection
- [ ] 3.2 Create `tests/unit/config/skillAgentMap.test.js` with tests for: valid config, missing pattern, missing agent, invalid regex, empty array
- [ ] 3.3 Update `tests/unit/discoverer.test.js` to verify agent injection during discovery

## 4. Integration & Verification

- [ ] 4.1 Run `npm run test` to verify all tests pass
- [ ] 4.2 Run `npm run lint` to verify no lint errors
- [ ] 4.3 Run `npm run coverage` to verify coverage is maintained
- [ ] 4.4 Verify `openspec status --change add-skill-agent-configurable-mapping --json` shows all artifacts complete