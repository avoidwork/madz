## Why

Currently, subAgent uses the child process PID for log file naming (`/tmp/sub-agent-${child.pid}.log`). PIDs are ephemeral and can be reused by the OS, making it difficult to correlate logs across the main process and sub-agents. A shared session ID would provide consistent, traceable logging that survives process lifecycle changes and makes debugging parallel/sequential fan-out scenarios much easier.

## What Changes

- Generate a unique session ID (UUID v4) at subAgent invocation time in the main process
- Pass session ID to sub-agents via `MADZ_SESSION_ID` environment variable
- Replace PID-based log file naming with session ID-based naming: `/tmp/sub-agent-{sessionId}.log`
- Update `subAgentLog` tool to accept `sessionId` as an alternative to `pid` for filtering and reading logs
- Update log pattern regex to support alphanumeric session IDs

## Capabilities

### New Capabilities
- `subagent-session-id`: Shared session ID generation and propagation for sub-agent log correlation

### Modified Capabilities
<!-- None — no existing spec-level requirements are changing -->

## Impact

- `src/tools/subAgent.js` — session ID generation, env var passing, log path update
- `src/tools/subAgentLog.js` — regex update, sessionId parameter support
- `src/tools/subAgentMessage.js` — optional: session ID as alternative lookup key
- Test files — update existing tests and add new ones for session ID functionality