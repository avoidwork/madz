## 1. Rewrite process.js with unified implementation

- [x] 1.1 Merge executeForeground and executeBackground from shell.js into process.js as start action handlers
- [x] 1.2 Change background spawn stdio from ["ignore","ignore","ignore"] to ["ignore","pipe","pipe"] to capture stdout/stderr
- [x] 1.3 Capture stdout/stderr streams in processTracker entry during spawn (store as buffer arrays, flush on exit)
- [x] 1.4 Implement start action: accept command + optional background flag, route to foreground or background handler
- [x] 1.5 Implement log action: return captured stdout and stderr from processTracker entry
- [x] 1.6 Implement wait action: block until process exits, return exit status
- [x] 1.7 Keep existing poll, kill, write, pause, resume, list actions (refactor poll into list)
- [x] 1.8 Update Zod schema: add command (required for start), background (optional bool), remove separate shell schema
- [x] 1.9 Update TOOL_CLASSIFICATION to include ['coding', 'debug', 'code-review', 'research']
- [x] 1.10 Add JSDoc comments to all public functions with @param and @returns

## 2. Update tool registration

- [x] 2.1 Remove shell export from src/tools/shell.js (delete file)
- [x] 2.2 Update src/tools/index.js: remove shell import, remove shell from tools array
- [x] 2.3 Register unified process tool in place of both shell and process
- [x] 2.4 Update TOOL_PERMISSIONS: keep filesystem:exec + process:spawn
- [x] 2.5 Remove shell.test.js (migrate tests to process.test.js)

## 3. Write comprehensive tests

- [x] 3.1 Test start action with foreground command (echo, ls)
- [x] 3.2 Test start action with background: true (sleep, long-running)
- [x] 3.3 Test log action returns captured stdout for background process
- [x] 3.4 Test log action returns captured stderr for background process
- [x] 3.5 Test log action returns error for non-existent processId
- [x] 3.6 Test wait action blocks and returns exit status
- [x] 3.7 Test kill action sends SIGTERM then SIGKILL
- [x] 3.8 Test write action sends data to stdin
- [x] 3.9 Test pause/resume actions with SIGSTOP/SIGCONT
- [x] 3.10 Test list action returns all tracked processes
- [x] 3.11 Test invalid action returns validation error
- [x] 3.12 Test missing command on start returns validation error
- [x] 3.13 Test missing processId on log returns error
- [x] 3.14 Test process already exited returns status

## 4. Update documentation

- [x] 4.1 Update AGENTS.md tool descriptions to reflect unified process tool
- [x] 4.2 Remove shell tool references from AGENTS.md
- [x] 4.3 Update any other documentation referencing shell or process tools

## 5. Verify and test

- [x] 5.1 Run npm run test and verify all tests pass
- [x] 5.2 Run npm run lint and verify no lint errors
- [x] 5.3 Run npm run coverage and verify coverage maintained
- [x] 5.4 Run timeout 10 npm start to verify app starts without crashing