## 1. Create scanAgents Tool

- [ ] 1.1 Create src/tools/scanAgents.js with implementation function, LangChain tool definition, and factory function
- [ ] 1.2 Implement scanAgentsImpl: accept optional path parameter, resolve path, check for AGENTS.md, read if found, return empty string if not found
- [ ] 1.3 Use validatePath and checkFileLimit from src/tools/common.js for path safety and size limits
- [ ] 1.4 Follow the minimal tool pattern from src/tools/date.js (implementation function, tool() decorator, factory function)

## 2. Register Tool in index.js

- [ ] 2.1 Add scanAgents: [] to TOOL_PERMISSIONS map (no permissions required)
- [ ] 2.2 Add scanAgents: createScanAgentsTool to TOOL_FACTORIES map
- [ ] 2.3 Add scanAgents to the switch statement in buildToolConfig alongside clarify, executeCode, sampling, and date

## 3. Write Tests

- [ ] 3.1 Create src/tools/scanAgents.test.js
- [ ] 3.2 Test: AGENTS.md exists and is readable — returns file contents
- [ ] 3.3 Test: AGENTS.md does not exist — returns empty string
- [ ] 3.4 Test: Path traversal attempt — returns error message
- [ ] 3.5 Test: File exceeds size limit — returns error message
- [ ] 3.6 Test: Default path (no argument) — uses process.cwd()

## 4. Verify

- [ ] 4.1 Run npm run test and verify all tests pass
- [ ] 4.2 Run npm run lint and verify no lint errors
- [ ] 4.3 Run npm start and verify application starts without errors