## 1. Rewrite process.js with unified implementation

- [ ] 1.1 Merge executeForeground and executeBackground from shell.js into process.js as start action handlers
- [ ] 1.2 Change background spawn stdio from ["ignore","ignore","ignore"] to ["ignore","pipe","pipe"] to capture stdout/stderr
- [ ] 1.3 Capture stdout/stderr streams in processTracker entry during spawn (store as buffer arrays, flush on exit)
- [ ] 1.4 Implement start action: accept command + optional background flag, route to foreground or background handler
- [ ] 1.5 Implement log action: return captured stdout and stderr from processTracker entry
- [ ] 1.6 Implement wait action: block until process exits, return exit status
- [ ] 1.7 Keep existing poll, kill, write, pause, resume, list actions (refactor poll into list)
- [ ] 1.8 Update Zod schema: add command (required for start), background (optional bool), remove separate shell schema
- [ ] 1.9 Update TOOL_CLASSIFICATION to include ['coding', 'debug', 'code-review', 'research']
- [ ] 1.10 Add JSDoc comments to all public functions with @param and @returns

## 2. Update tool registration

- [ ] 2.1 Remove shell export from src/tools/shell.js (delete file)
- [ ] 2.2 Update src/tools/index.js: remove shell import, remove shell from tools array
- [ ] 2.3 Register unified process tool in place of both shell and process
- [ ] 2.4 Update TOOL_PERMISSIONS: keep filesystem:exec + process:spawn
- [ ] 2.5 Remove shell.test.js (migrate tests to process.test.js)

## 3. Write comprehensive tests

- [ ] 3.1 Test start action with foreground command (echo, ls)
- [ ] 3.2 Test start action with background: true (sleep, long-running)
- [ ] 3.3 Test log action returns captured stdout for background process
- [ ] 3.4 Test log action returns captured stderr for background process
- [ ] 3.5 Test log action returns error for non-existent processId
- [ ] 3.6 Test wait action blocks and returns exit status
- [ ] 3.7 Test kill action sends SIGTERM then SIGKILL
- [ ] 3.8 Test write action sends data to stdin
- [ ] 3.9 Test pause/resume actions with SIGSTOP/SIGCONT
- [ ] 3.10 Test list action returns all tracked processes
- [ ] 3.11 Test invalid action returns validation error
- [ ] 3.12 Test missing command on start returns validation error
- [ ] 3.13 Test missing processId on log returns error
- [ ] 3.14 Test process already exited returns status

## 4. Update documentation

- [ ] 4.1 Update AGENTS.md tool descriptions to reflect unified process tool
- [ ] 4.2 Remove shell tool references from AGENTS.md
- [ ] 4.3 Update any other documentation referencing shell or process tools

## 5. Verify and test

- [ ] 5.1 Run npm run test and verify all tests pass
- [ ] 5.2 Run npm run lint and verify no lint errors
- [ ] 5.3 Run npm run coverage and verify coverage maintained
- [ ] 5.4 Run timeout 10 npm start to verify app starts without crashing