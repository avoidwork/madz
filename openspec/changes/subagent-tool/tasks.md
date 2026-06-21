## 1. Setup and Configuration

- [ ] 1.1 Add `process.subAgent` configuration section to config.yaml (timeout, maxConcurrent, sessionMode, defaultStrategy, defaultOnError)
- [ ] 1.2 Create src/tools/subAgent.js module with subAgent implementation
- [ ] 1.3 Export createSubAgentTool factory from subAgent.js

## 2. Core Implementation — Single Execution

- [ ] 2.1 Implement prompt construction: combine context + delegation with `|||` separator
- [ ] 2.2 Implement prompt shell escaping (quotes, backticks, dollar signs, newlines)
- [ ] 2.3 Implement spawn logic: `spawn("node", [indexPath, escapedPrompt, sessionsDir])` mirroring compaction tool
- [ ] 2.4 Implement marker-based stdout parsing: split on `# SubAgent`, return `{ ok, result, error? }`
- [ ] 2.5 Implement timeout resolution: per-call > env var > config default
- [ ] 2.6 Implement process tracking via shared processTracker from terminal.js
- [ ] 2.7 Implement graceful termination: SIGTERM → SIGKILL on timeout

## 3. Core Implementation — Fan-out Mode

- [ ] 3.1 Implement fan-out task queue with parallel/sequential strategy support
- [ ] 3.2 Implement maxConcurrent semaphore for parallel mode
- [ ] 3.3 Implement onError handling: "continue" vs "fail-fast"
- [ ] 3.4 Implement result aggregation for fan-out mode

## 4. Core Implementation — Parameter Extraction

- [ ] 4.1 Implement returnParams filtering: parse JSON result, filter to specified keys
- [ ] 4.2 Implement fallback to full text when output is not valid JSON

## 5. Core Implementation — Session Isolation

- [ ] 5.1 Implement sessionMode: "isolated" (fresh session)
- [ ] 5.2 Implement sessionMode: "forked" (compaction in new session)
- [ ] 5.3 Implement sessionMode: "shared" (parent session)

## 6. Tool Registration

- [ ] 6.1 Add `subAgent` to TOOL_PERMISSIONS in src/tools/index.js (requires process:spawn)
- [ ] 6.2 Add `subAgent` to TOOL_FACTORIES in src/tools/index.js
- [ ] 6.3 Verify tool registers when process:spawn permission is enabled
- [ ] 6.4 Verify tool does not register when process:spawn permission is disabled

## 7. Testing

- [ ] 7.1 Write unit tests for single execution success case
- [ ] 7.2 Write unit tests for single execution failure case (missing marker, empty result)
- [ ] 7.3 Write unit tests for fan-out parallel mode
- [ ] 7.4 Write unit tests for fan-out sequential mode
- [ ] 7.5 Write unit tests for timeout enforcement (per-call, env var, config default)
- [ ] 7.6 Write unit tests for returnParams filtering
- [ ] 7.7 Write unit tests for process tracking (spawn, exit, error)
- [ ] 7.8 Write unit tests for prompt escaping (quotes, backticks, dollar signs, newlines)
- [ ] 7.9 Write unit tests for session isolation modes

## 8. Verification

- [ ] 8.1 Run full test suite and verify all tests pass
- [ ] 8.2 Run lint and verify no issues
- [ ] 8.3 Verify application starts without crashing
- [ ] 8.4 Verify no regressions in existing functionality