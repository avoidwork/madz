## 1. Create Reflection Tool

- [ ] 1.1 Create `src/tools/reflection.js` with zod input schema
- [ ] 1.2 Implement session file reading using `fs/promises`
- [ ] 1.3 Implement YAML frontmatter parsing using `js-yaml`
- [ ] 1.4 Implement date window filtering by `startedAt`
- [ ] 1.5 Implement ignore pattern filtering (frontmatter + body)
- [ ] 1.6 Implement user message extraction (role === "user")
- [ ] 1.7 Implement structured output format (sessionId, startedAt, userMessages)
- [ ] 1.8 Add graceful error handling for malformed files

## 2. Register Tool in Index

- [ ] 2.1 Import reflection tool in `src/tools/index.js`
- [ ] 2.2 Add `reflection` to `TOOL_PERMISSIONS` with `["filesystem:read"]`
- [ ] 2.3 Add `reflection` to `TOOL_CLASSIFICATIONS` with `["orchestrator"]`
- [ ] 2.4 Add `reflection` to `TOOLS` object

## 3. Write Tests

- [ ] 3.1 Create `tests/unit/tools/reflection.test.js`
- [ ] 3.2 Test: read sessions from memory directory
- [ ] 3.3 Test: handle empty sessions directory
- [ ] 3.4 Test: filter sessions by date window
- [ ] 3.5 Test: filter sessions by ignore patterns
- [ ] 3.6 Test: extract only user messages
- [ ] 3.7 Test: return structured data format
- [ ] 3.8 Test: handle malformed YAML frontmatter
- [ ] 3.9 Test: handle malformed JSON body

## 4. Verification

- [ ] 4.1 Run `npm run lint`
- [ ] 4.2 Run `npm run test`
- [ ] 4.3 Run `npm start` with timeout to verify app starts
