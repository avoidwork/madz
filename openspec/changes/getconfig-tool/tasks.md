## 1. Create Tool Implementation

- [x] 1.1 Create `src/tools/codeIndex/getConfig.js` with `getConfig` tool using `tool()` wrapper and empty Zod schema
- [x] 1.2 Register `getConfig` in `src/tools/index.js` (TOOL_PERMISSIONS, TOOL_CLASSIFICATIONS, ORCHESTRATOR_TOOLS, TOOLS map)

## 2. Write Tests

- [x] 2.1 Create `tests/unit/tools/getConfig.test.js` covering success path, error propagation, and schema validation

## 3. Verify

- [x] 3.1 Run `npm run test` and confirm all tests pass
- [x] 3.2 Run `npm run lint` and confirm no lint errors
- [x] 3.3 Run `npm run coverage` and confirm coverage is maintained
