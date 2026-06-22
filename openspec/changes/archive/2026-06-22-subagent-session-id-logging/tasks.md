## 1. Session ID Generation

- [x] 1.1 Add `crypto.randomUUID()` import to `src/tools/subAgent.js`
- [x] 1.2 Create `generateSessionId()` export function that returns `crypto.randomUUID()`
- [x] 1.3 Write unit tests for `generateSessionId()` — verify UUID v4 format and uniqueness

## 2. SubAgent Process Spawning

- [x] 2.1 Update `spawnSubAgentProcess()` to generate and store session ID
- [x] 2.2 Pass `MADZ_SESSION_ID` env var to child process via `spawn()` env option
- [x] 2.3 Update log path from `/tmp/sub-agent-${child.pid}.log` to `/tmp/sub-agent-${sessionId}.log`
- [x] 2.4 Update return type to include `sessionId` in resolved promise
- [x] 2.5 Update `trackProcess()` call to pass session ID

## 3. subAgentLog Tool Updates

- [x] 3.1 Update log pattern regex from `/^sub-agent-(\d+)\.log$/` to `/^sub-agent-[a-zA-Z0-9]+\.log$/`
- [x] 3.2 Add `sessionId` parameter to `subAgentLog` tool schema (alternative to `pid`)
- [x] 3.3 Update `listLogs()` to support filtering by `sessionId` parameter
- [x] 3.4 Update `readLog()` to construct path from `sessionId` parameter
- [x] 3.5 Ensure backward compatibility — `pid` parameter still works

## 4. subAgentMessage Tool (Optional)

- [x] 4.1 Evaluate if `processTracker` needs session ID as alternative lookup key
- [x] 4.2 If needed, add session ID tracking alongside PID in `processTracker`

## 5. Testing

- [x] 5.1 Write integration test: verify session ID is passed to child process via `process.env.MADZ_SESSION_ID`
- [x] 5.2 Write integration test: verify log file is created with session ID naming
- [x] 5.3 Write integration test: verify main process and sub-agent can read same log file
- [x] 5.4 Update existing subAgent tests to account for session ID changes
- [x] 5.5 Run full test suite and verify all tests pass

## 6. Verification

- [x] 6.1 Run `npm run lint` and fix any lint errors
- [x] 6.2 Run `npm run test` and verify all tests pass
- [x] 6.3 Verify application starts without crashing (`npm start`)
- [x] 6.4 Confirm no PID-based log files are created for new invocations