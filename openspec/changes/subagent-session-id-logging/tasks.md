## 1. Session ID Generation

- [ ] 1.1 Add `crypto.randomUUID()` import to `src/tools/subAgent.js`
- [ ] 1.2 Create `generateSessionId()` export function that returns `crypto.randomUUID()`
- [ ] 1.3 Write unit tests for `generateSessionId()` — verify UUID v4 format and uniqueness

## 2. SubAgent Process Spawning

- [ ] 2.1 Update `spawnSubAgentProcess()` to generate and store session ID
- [ ] 2.2 Pass `MADZ_SESSION_ID` env var to child process via `spawn()` env option
- [ ] 2.3 Update log path from `/tmp/sub-agent-${child.pid}.log` to `/tmp/sub-agent-${sessionId}.log`
- [ ] 2.4 Update return type to include `sessionId` in resolved promise
- [ ] 2.5 Update `trackProcess()` call to pass session ID

## 3. subAgentLog Tool Updates

- [ ] 3.1 Update log pattern regex from `/^sub-agent-(\d+)\.log$/` to `/^sub-agent-[a-zA-Z0-9]+\.log$/`
- [ ] 3.2 Add `sessionId` parameter to `subAgentLog` tool schema (alternative to `pid`)
- [ ] 3.3 Update `listLogs()` to support filtering by `sessionId` parameter
- [ ] 3.4 Update `readLog()` to construct path from `sessionId` parameter
- [ ] 3.5 Ensure backward compatibility — `pid` parameter still works

## 4. subAgentMessage Tool (Optional)

- [ ] 4.1 Evaluate if `processTracker` needs session ID as alternative lookup key
- [ ] 4.2 If needed, add session ID tracking alongside PID in `processTracker`

## 5. Testing

- [ ] 5.1 Write integration test: verify session ID is passed to child process via `process.env.MADZ_SESSION_ID`
- [ ] 5.2 Write integration test: verify log file is created with session ID naming
- [ ] 5.3 Write integration test: verify main process and sub-agent can read same log file
- [ ] 5.4 Update existing subAgent tests to account for session ID changes
- [ ] 5.5 Run full test suite and verify all tests pass

## 6. Verification

- [ ] 6.1 Run `npm run lint` and fix any lint errors
- [ ] 6.2 Run `npm run test` and verify all tests pass
- [ ] 6.3 Verify application starts without crashing (`npm start`)
- [ ] 6.4 Confirm no PID-based log files are created for new invocations