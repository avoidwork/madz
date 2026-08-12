## 1. Create Reflection Tool

- [x] 1.1 Create `src/tools/reflection.js` with zod input schema
- [x] 1.2 Implement session file reading using `fs/promises`
- [x] 1.3 Implement YAML frontmatter parsing using `js-yaml`
- [x] 1.4 Implement date window filtering by `startedAt`
- [x] 1.5 Implement ignore pattern filtering (frontmatter + body)
- [x] 1.6 Implement user message extraction (role === "user")
- [x] 1.7 Implement structured output format (sessionId, startedAt, userMessages)
- [x] 1.8 Add graceful error handling for malformed files

## 2. Register Tool in Index

- [x] 2.1 Import reflection tool in `src/tools/index.js`
- [x] 2.2 Add `reflection` to `TOOL_PERMISSIONS` with `["filesystem:read"]`
- [x] 2.3 Add `reflection` to `TOOL_CLASSIFICATIONS` with `["orchestrator"]`
- [x] 2.4 Add `reflection` to `TOOLS` object

## 3. Write Tests

- [x] 3.1 Create `tests/unit/tools/reflection.test.js`
- [x] 3.2 Test: read sessions from memory directory
- [x] 3.3 Test: handle empty sessions directory
- [x] 3.4 Test: filter sessions by date window
- [x] 3.5 Test: filter sessions by ignore patterns
- [x] 3.6 Test: extract only user messages
- [x] 3.7 Test: return structured data format
- [x] 3.8 Test: handle malformed YAML frontmatter
- [x] 3.9 Test: handle malformed JSON body

## 4. Verification

- [x] 4.1 Run `npm run lint`
- [x] 4.2 Run `npm run test`
- [x] 4.3 Run `npm start` with timeout to verify app starts
