## 1. Create Tool Implementation

- [ ] 1.1 Create `src/tools/codeIndex/getConfig.js` with `getConfig` tool using `tool()` wrapper and empty Zod schema
- [ ] 1.2 Register `getConfig` in `src/tools/index.js` (TOOL_PERMISSIONS, TOOL_CLASSIFICATIONS, ORCHESTRATOR_TOOLS, TOOLS map)

## 2. Write Tests

- [ ] 2.1 Create `tests/unit/tools/getConfig.test.js` covering success path, error propagation, and schema validation

## 3. Verify

- [ ] 3.1 Run `npm run test` and confirm all tests pass
- [ ] 3.2 Run `npm run lint` and confirm no lint errors
- [ ] 3.3 Run `npm run coverage` and confirm coverage is maintained
