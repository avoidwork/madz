## Why

The current codebase has a pino logger (`src/logger.js`) but no structured logging of LangGraph client events (tool calls, LLM responses, errors) or skill execution. This makes debugging agent interactions difficult — there's no visibility into what tools were called, what the LLM returned, or where failures occurred. Users need structured, config-driven logging to diagnose issues without enabling verbose debug output in production.

## What Changes

- Add `logging` section to `config.yaml` with configurable log level (default: "info") and optional format
- Create `src/logging/config.js` — config-driven pino logger factory
- Create `src/logging/handlers.js` — event handlers for LangGraph stream events (tool_start, tool_end, tool_error, llm_response, llm_error, compaction)
- Instrument `src/agent/react.js` — log streaming events and invoke path responses/errors
- Instrument `src/skills/registry.js` — log skill execution (call, success, error)
- Add `logging` config schema to `src/config/schemas.js`
- Add comprehensive unit tests for all new modules
- `src/logger.js` remains unchanged as a fallback

## Capabilities

### New Capabilities
- `structured-logging`: Config-driven structured logging for LangGraph client events (tool calls, LLM responses, errors) and skill execution. Includes configurable log level, structured `type` field for filtering, and truncation of large inputs/outputs.

### Modified Capabilities
<!-- None — this is a new capability, not a modification of existing spec-level behavior -->

## Impact

- **Affected code**: `src/config/schemas.js`, `config.yaml`, `src/agent/react.js`, `src/skills/registry.js`
- **New files**: `src/logging/config.js`, `src/logging/handlers.js`
- **Tests**: New unit tests for logging modules, integration tests for react.js and registry.js
- **Dependencies**: No new dependencies — uses existing pino logger
- **Backward compatibility**: `src/logger.js` unchanged; existing code continues to work
