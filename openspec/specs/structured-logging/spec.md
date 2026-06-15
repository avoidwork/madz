# structured-logging Specification

## Purpose
TBD - created by archiving change structured-debug-logging. Update Purpose after archive.
## Requirements
### Requirement: Config-driven log level
The system SHALL read the `logging.level` setting from `config.yaml` and use it to configure the pino logger. The default level SHALL be "info" when not specified. Valid levels are "debug", "info", "warn", and "error". Invalid levels SHALL fall back to "info" with a warning logged to stderr.

#### Scenario: Default log level
- **WHEN** `logging` section is not present in config.yaml
- **THEN** the logger uses "info" level

#### Scenario: Custom log level
- **WHEN** `logging.level` is set to "debug" in config.yaml
- **THEN** the logger includes debug-level entries

#### Scenario: Invalid log level fallback
- **WHEN** `logging.level` is set to an invalid value (e.g., "verbose") in config.yaml
- **THEN** the logger falls back to "info" level and logs a warning to stderr

### Requirement: Structured stream event logging
The system SHALL log LangGraph stream events with a structured `type` field. Event types include: "tool_start", "tool_end", "tool_error", "llm_response", "llm_error", and "compaction". Each log entry SHALL include relevant structured data (tool name, call ID, input/output summaries, duration).

#### Scenario: Tool start logged
- **WHEN** a tool begins execution via `agent.streamEvents()`
- **THEN** a log entry with `type: "tool_start"` is written containing tool name, call ID, and input summary (truncated to 200 chars)

#### Scenario: Tool end logged with duration
- **WHEN** a tool completes execution
- **THEN** a log entry with `type: "tool_end"` is written containing tool name, call ID, result summary (truncated to 200 chars), and execution duration in milliseconds

#### Scenario: Tool error logged
- **WHEN** a tool fails during execution
- **THEN** a log entry with `type: "tool_error"` is written containing tool name, call ID, and error message

#### Scenario: LLM response logged
- **WHEN** an LLM response is received via streaming or invoke
- **THEN** a log entry with `type: "llm_response"` is written containing model name (if available), token counts (if available), and response preview (first 200 chars)

#### Scenario: LLM error logged
- **WHEN** an LLM error occurs
- **THEN** a log entry with `type: "llm_error"` is written containing model name, error message, and retry info

#### Scenario: Compaction logged
- **WHEN** conversation compaction begins or ends
- **THEN** a log entry with `type: "compaction"` is written containing the event (start/end), message count, and target tokens

### Requirement: Skill execution logging
The system SHALL log skill execution with structured entries. Event types include: "skill_call", "skill_success", and "skill_error". Each log entry SHALL include the skill name and relevant context.

#### Scenario: Skill call logged
- **WHEN** a skill begins execution
- **THEN** a log entry with `type: "skill_call"` is written containing the skill name and input summary

#### Scenario: Skill success logged
- **WHEN** a skill completes successfully
- **THEN** a log entry with `type: "skill_success"` is written containing the skill name and execution duration

#### Scenario: Skill error logged
- **WHEN** a skill fails during execution
- **THEN** a log entry with `type: "skill_error"` is written containing the skill name, error message, and truncated stack trace (500 chars)

### Requirement: Test coverage
The system SHALL include unit tests for all new logging modules (`src/logging/config.js`, `src/logging/handlers.js`) and integration tests for instrumented modules (`src/agent/react.js`, `src/skills/registry.js`). All existing tests SHALL continue to pass.

#### Scenario: Config logger tests pass
- **WHEN** `npm run test` is executed
- **THEN** tests for `src/logging/config.js` pass (default level, custom levels, invalid level fallback, test suppression)

#### Scenario: Handler tests pass
- **WHEN** `npm run test` is executed
- **THEN** tests for `src/logging/handlers.js` pass (all event types, truncation, duration calculation)

#### Scenario: Regression tests pass
- **WHEN** `npm run test` is executed
- **THEN** all existing tests continue to pass

