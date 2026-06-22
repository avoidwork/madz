## 1. Create compaction tool implementation

- [ ] 1.1 Create `src/tools/compaction.js` with `parseCompactionOutput()` function that splits stdout on `# Compaction` marker and returns `{ ok, summary, error? }`
- [ ] 1.2 Implement `spawnCompactionProcess()` function that spawns node process with command and sessionsDir, handles stdout/stderr capture, 60s timeout, and error events
- [ ] 1.3 Implement `createCompactionTool()` factory function that returns a LangChain Tool with name "compaction", description, and zod schema (optional threadID string, optional maxMessages positive integer)

## 2. Register compaction tool in tool registry

- [ ] 2.1 Add import for `createCompactionTool` in `src/tools/index.js`
- [ ] 2.2 Add `compaction: []` to `TOOL_PERMISSIONS` object in `src/tools/index.js`
- [ ] 2.3 Add `compaction: createCompactionTool` to `TOOL_FACTORIES` object in `src/tools/index.js`

## 3. Write unit tests

- [ ] 3.1 Create `tests/unit/tools_compaction.test.js` with tests for `parseCompactionOutput`: happy path with marker, missing marker, empty output, null output, marker with no content, multiple markers (takes index[1]), thinking/reasoning before marker, multiline summary content
- [ ] 3.2 Add tests for `createCompactionTool`: returns correct name "compaction", has description with "semantic summarization", has zod schema, uses default sessionsDir, uses custom sessionsDir
- [ ] 3.3 Add integration tests: tool registered via `buildToolConfig` without permissions, tool registered via `buildToolConfig` with other permissions

## 4. Verify implementation

- [ ] 4.1 Run full test suite (`npm test`) and verify all tests pass
- [ ] 4.2 Run lint (`npm run lint`) and verify no lint errors
- [ ] 4.3 Verify application starts (`npm start`) without crashing