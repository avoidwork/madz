## 1. Setup and Configuration

- [x] 1.1 Add `process.subAgent` configuration section to config.yaml (timeout, maxConcurrent, sessionMode, defaultStrategy, defaultOnError)
- [x] 1.2 Create src/tools/subAgent.js module with subAgent implementation
- [x] 1.3 Export createSubAgentTool factory from subAgent.js

## 2. Core Implementation — Single Execution

- [x] 2.1 Implement prompt construction: combine context + delegation with `|||` separator
- [x] 2.2 Implement prompt shell escaping (quotes, backticks, dollar signs, newlines)
- [x] 2.3 Implement spawn logic: `spawn("node", [indexPath, escapedPrompt, sessionsDir])` mirroring compaction tool
- [x] 2.4 Implement marker-based stdout parsing: split on `# SubAgent`, return `{ ok, result, error? }`
- [x] 2.5 Implement timeout resolution: per-call > env var > config default
- [x] 2.6 Implement process tracking via shared processTracker from terminal.js
- [x] 2.7 Implement graceful termination: SIGTERM → SIGKILL on timeout

## 3. Core Implementation — Fan-out Mode

- [x] 3.1 Implement fan-out task queue with parallel/sequential strategy support
- [x] 3.2 Implement maxConcurrent semaphore for parallel mode
- [x] 3.3 Implement onError handling: "continue" vs "fail-fast"
- [x] 3.4 Implement result aggregation for fan-out mode

## 4. Core Implementation — Parameter Extraction

- [x] 4.1 Implement returnParams filtering: parse JSON result, filter to specified keys
- [x] 4.2 Implement fallback to full text when output is not valid JSON

## 5. Core Implementation — Session Isolation

- [x] 5.1 Implement sessionMode: "isolated" (fresh session)
- [x] 5.2 Implement sessionMode: "forked" (compaction in new session)
- [x] 5.3 Implement sessionMode: "shared" (parent session)

## 6. Tool Registration

- [x] 6.1 Add `subAgent` to TOOL_PERMISSIONS in src/tools/index.js (requires process:spawn)
- [x] 6.2 Add `subAgent` to TOOL_FACTORIES in src/tools/index.js
- [x] 6.3 Verify tool registers when process:spawn permission is enabled
- [x] 6.4 Verify tool does not register when process:spawn permission is disabled

## 7. Testing

- [x] 7.1 Write unit tests for single execution success case
- [x] 7.2 Write unit tests for single execution failure case (missing marker, empty result)
- [x] 7.3 Write unit tests for fan-out parallel mode
- [x] 7.4 Write unit tests for fan-out sequential mode
- [x] 7.5 Write unit tests for timeout enforcement (per-call, env var, config default)
- [x] 7.6 Write unit tests for returnParams filtering
- [x] 7.7 Write unit tests for process tracking (spawn, exit, error)
- [x] 7.8 Write unit tests for prompt escaping (quotes, backticks, dollar signs, newlines)
- [x] 7.9 Write unit tests for session isolation modes

## 8. Verification

- [x] 8.1 Run full test suite and verify all tests pass
- [x] 8.2 Run lint and verify no issues
- [x] 8.3 Verify application starts without crashing
- [x] 8.4 Verify no regressions in existing functionality