## 1. Create scanAgents Tool

- [x] 1.1 Create src/tools/scanAgents.js with implementation function, LangChain tool definition, and factory function
- [x] 1.2 Implement scanAgentsImpl: accept optional path parameter, resolve path, check for AGENTS.md, read if found, return empty string if not found
- [x] 1.3 Use validatePath and checkFileLimit from src/tools/common.js for path safety and size limits
- [x] 1.4 Follow the minimal tool pattern from src/tools/date.js (implementation function, tool() decorator, factory function)

## 2. Register Tool in index.js

- [x] 2.1 Add scanAgents: [] to TOOL_PERMISSIONS map (no permissions required)
- [x] 2.2 Add scanAgents: createScanAgentsTool to TOOL_FACTORIES map
- [x] 2.3 Add scanAgents to the switch statement in buildToolConfig alongside clarify, executeCode, sampling, and date

## 3. Write Tests

- [x] 3.1 Create tests/unit/tools_scanAgents.test.js
- [x] 3.2 Test: AGENTS.md exists and is readable — returns file contents
- [x] 3.3 Test: AGENTS.md does not exist — returns empty string
- [x] 3.4 Test: Path traversal attempt — returns error message
- [x] 3.5 Test: File exceeds size limit — returns error message
- [x] 3.6 Test: Default path (no argument) — uses process.cwd()

## 4. Verify

- [x] 4.1 Run npm run test and verify all tests pass
- [x] 4.2 Run npm run lint and verify no lint errors
- [x] 4.3 Run npm start and verify application starts without errors