## Context

The madz project uses pino for logging (`src/logger.js`) with debug-level output to dual files (`madz.log` and `madz_error.log`). However, there is no structured logging of LangGraph client events — tool calls, LLM responses, errors — or skill execution. This makes debugging agent interactions difficult. The issue requests structured logging with a configurable log level (default: "info") specified in `config.yaml`.

## Goals / Non-Goals

**Goals:**
- Config-driven logging with `logging` section in `config.yaml` (level: debug|info|warn|error, default: "info")
- Structured logging of LangGraph stream events (tool_start, tool_end, tool_error, llm_response, llm_error, compaction)
- Structured logging of LangGraph invoke path (llm_response, llm_error, compaction)
- Structured logging of skill execution (skill_call, skill_success, skill_error)
- All log entries include a `type` field for easy filtering
- Truncation of large inputs/outputs to prevent log bloat
- Comprehensive unit tests for all new modules
- Backward compatibility with existing `src/logger.js`

**Non-Goals:**
- Log rotation (out of scope)
- Log aggregation or remote shipping
- Changing the existing `src/logger.js` fallback logger
- Performance optimization beyond using pino's inherent async behavior

## Decisions

1. **Separate logger module (`src/logging/config.js`)**: Create a new module separate from `src/logger.js` to allow config-driven behavior without modifying the existing fallback logger. This avoids breaking changes and keeps the fallback intact for any code that imports from `src/logger.js`.

2. **Structured `type` field**: All log entries include a `type` field (e.g., "tool_start", "llm_response") for easy filtering. This is more useful than relying on log levels alone, since different event types have different informational value.

3. **Truncation limits**: Tool inputs/outputs truncated to 200 chars, stack traces to 500 chars. This prevents log bloat while retaining enough information for debugging.

4. **Duration tracking client-side**: Tool execution duration is calculated by recording timestamps on tool_start and tool_end events in the handler, not by the LangGraph client. This works because the handler callbacks fire synchronously around each event.

5. **Pino multistream**: The new logger uses the same OS-aware log directory detection and dual-file output pattern as `src/logger.js`, but is driven by the config file rather than hardcoded.

## Risks / Trade-offs

- **Log volume**: Debug-level logging could produce very large logs, especially with frequent tool calls. → Mitigation: default level is "info", truncation limits inputs/outputs.
- **Sensitive data**: Tool inputs may contain sensitive data (file contents, API keys). → Mitigation: truncation limits exposure; users should be aware that debug logs may contain interaction data.
- **Performance**: Logging overhead should be negligible (pino is fast), but debug-level logging during high-frequency tool calls could add up. → Mitigation: pino's async nature means logging doesn't block the event loop.
- **Breaking changes**: None — `src/logger.js` remains unchanged.

## Migration Plan

No migration needed. The new logging module is additive:
1. Deploy with default config (`logging.level: "info"`)
2. Users can enable debug logging by setting `logging.level: "debug"` in config.yaml
3. Existing code using `src/logger.js` continues to work unchanged

## Open Questions

- None at this time.
