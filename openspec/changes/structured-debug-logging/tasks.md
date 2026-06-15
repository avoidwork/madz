## 1. Config Schema and Default Config

- [x] 1.1 Add `logging` section to `src/config/schemas.js` with `level` (enum: debug|info|warn|error, default: "info") and `format` (enum: json|text, default: "json")
- [x] 1.2 Add `logging` section to default `config.yaml` with `level: info`

## 2. Logger Factory Module

- [x] 2.1 Create `src/logging/config.js` — config-driven pino logger factory that reads `logging` section from config, validates level, falls back to "info" on invalid values
- [x] 2.2 Implement OS-aware log directory detection (reuse pattern from `src/logger.js`)
- [x] 2.3 Implement dual-file output (madz.log for info+, madz_error.log for error+)
- [x] 2.4 Handle test environment (NODE_ENV=test → silent mode)

## 3. Stream Event Handler Module

- [x] 3.1 Create `src/logging/handlers.js` — event handler factory that produces callbacks for `agent.streamEvents()`
- [x] 3.2 Implement `tool_start` handler: log tool name, call ID, input summary (truncated to 200 chars), record start timestamp
- [x] 3.3 Implement `tool_end` handler: log tool name, call ID, result summary (truncated to 200 chars), execution duration
- [x] 3.4 Implement `tool_error` handler: log tool name, call ID, error message
- [x] 3.5 Implement `llm_response` handler: log model name, token counts, response preview (first 200 chars)
- [x] 3.6 Implement `llm_error` handler: log model name, error message, retry info
- [x] 3.7 Implement `compaction` handler: log start/end with message count and target tokens

## 4. Instrument React Agent

- [x] 4.1 Modify `src/agent/react.js` `callReactAgentStreaming()` — import logger, create event handlers, wrap callback chain
- [x] 4.2 Modify `src/agent/react.js` `callReactAgent()` — log llm_response after invoke, llm_error on failure, compaction events
- [x] 4.3 Ensure tool duration tracking works correctly (start timestamp → end duration)

## 5. Instrument Skill Registry

- [x] 5.1 Find skill execution entry point in `src/skills/registry.js`
- [x] 5.2 Wrap skill execution with try/catch and structured logging (skill_call, skill_success, skill_error)
- [x] 5.3 Truncate stack traces to 500 chars on error

## 6. Testing

- [x] 6.1 Write unit tests for `src/logging/config.js` — default level, custom levels, invalid level fallback, test suppression
- [x] 6.2 Write unit tests for `src/logging/handlers.js` — tool_start/end/error events, llm_response/error, compaction, truncation, duration
- [x] 6.3 Write integration tests for `src/agent/react.js` — verify logging on stream and invoke paths (mocked agent)
- [x] 6.4 Write integration tests for `src/skills/registry.js` — verify skill execution logging (mocked skill)
- [x] 6.5 Verify all existing tests still pass (`npm run test`)
