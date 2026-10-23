## 1. Implement the replacement middleware

- [x] 1.1 Create `src/agent/skillsMiddleware.js` with a middleware named `SkillsMiddleware` that injects a prompt directing the agent to the `skill` tool.
- [x] 1.2 Load the skill catalog via `registry.getCatalog()` and format it without the "→ Read `<path>`" line.
- [x] 1.3 Register the replacement middleware in `createDeepAgentsOrchestrator`'s middleware array in `src/agent/deepAgents.js`.

## 2. Tests

- [x] 2.1 Add `tests/unit/skillsMiddleware.test.js` covering: middleware is named `SkillsMiddleware`, injects the `skill` tool instruction, does not instruct `read_file`, lists skills, handles empty registry, passes the request through.

## 3. Verify

- [x] 3.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm everything passes.
