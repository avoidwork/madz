## 1. Create factory function

- [ ] 1.1 Create `src/agent/definitions/factory.js` with `createAgentDefinition(name, promptFile, description)` function
- [ ] 1.2 Factory returns agent object with `name`, `description`, `systemPrompt` properties
- [ ] 1.3 Factory loads prompt asynchronously from `prompts/<promptFile>` using `readFile`
- [ ] 1.4 Factory imports `logger` from `../../logger.js` for error handling

## 2. Refactor individual agent files

- [ ] 2.1 Rewrite `coding.js` to use factory
- [ ] 2.2 Rewrite `code-review.js` to use factory
- [ ] 2.3 Rewrite `debug.js` to use factory
- [ ] 2.4 Rewrite `documentation.js` to use factory
- [ ] 2.5 Rewrite `performance.js` to use factory
- [ ] 2.6 Rewrite `research.js` to use factory
- [ ] 2.7 Rewrite `search.js` to use factory
- [ ] 2.8 Rewrite `security-audit.js` to use factory
- [ ] 2.9 Rewrite `testing.js` to use factory

## 3. Update index.js exports

- [ ] 3.1 Update `src/agent/definitions/index.js` to import from new location
- [ ] 3.2 Preserve existing export order and `getAllAgents()` function

## 4. Rename directory and update imports

- [ ] 4.1 Rename `src/agent/agents/` → `src/agent/definitions/` using `git mv`
- [ ] 4.2 Find and update all external imports referencing `src/agent/agents/`
- [ ] 4.3 Verify no remaining references to old path

## 5. Verify and test

- [x] 5.1 Run `npm test` to verify all tests pass
- [x] 5.2 Run `npm start` with timeout to verify application starts
- [x] 5.3 Verify all 9 agents are still accessible via `getAllAgents()`
