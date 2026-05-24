## ADDED Requirements

### Requirement: Span instrumentation for LLM interactions
The system SHALL create OpenTelemetry spans for every LLM API interaction including chat, completion, and streaming calls.

#### Scenario: LLM call span created
- **WHEN** the system sends a request to an LLM provider
- **THEN** the system creates a span named `llm.{provider}.chat` with attributes for model, token count, and latency

#### Scenario: Span completed on response
- **WHEN** the LLM provider returns a response
- **THEN** the system ends the span and records the total latency and any error that occurred

#### Scenario: Streaming span tracks chunks
- **WHEN** the system receives streaming responses
- **THEN** the system creates a child span per streaming session and records chunk count and total bytes on completion

### Requirement: Span instrumentation for skill execution
The system SHALL create OpenTelemetry spans for every skill/tool invocation within the sandbox.

#### Scenario: Tool call span created
- **WHEN** a registered skill is invoked
- **THEN** the system creates a span named `tool.{skill-name}` with attributes for skill inputs, memory context reference, and sandbox parameters

#### Scenario: Tool span records outcome
- **WHEN** a skill execution completes
- **THEN** the span records the execution status, duration, exit code, and output summary

### Requirement: Span instrumentation for memory operations
The system SHALL create spans for memory read, write, and cleanup operations.

#### Scenario: Memory write span
- **WHEN** the system writes to a memory file (conversation, tool log, context)
- **THEN** the system creates a span named `memory.write` with attributes for file path and operation type

#### Scenario: Memory cleanup span
- **WHEN** the retention cleanup job removes expired memory files
- **THEN** the system creates a span named `memory.cleanup` with attributes for files removed and bytes freed

### Requirement: Metrics collection
The system SHALL collect and export OpenTelemetry metrics for token usage, latency, tool execution costs, error rates, and memory states.

#### Scenario: Token usage metric
- **WHEN** an LLM interaction completes
- **THEN** the system records a `llm.token.count` metric with attributes for model, provider, and direction (input/output)

#### Scenario: Latency metric
- **WHEN** any LLM call or tool execution completes
- **THEN** the system records a `operation.latency` histogram metric with attributes for operation type and result status

#### Scenario: Error rate metric
- **WHEN** a request fails (provider error, timeout, sandbox failure)
- **THEN** the system increments a `system.error.count` counter with attributes for error type and source component

### Requirement: Configurable sampling and redaction
The system SHALL apply configurable sampling rates and sensitive data redaction policies to all telemetry data before export.

#### Scenario: Sampling rate applied
- **WHEN** the telemetry configuration specifies a `sampling.rate` value
- **THEN** the OpenTelemetry sampler drops or keeps spans according to the configured rate

#### Scenario: Sensitive data redacted from spans
- **WHEN** a span contains attributes that match configured redaction patterns (e.g., `apiKey`, `token`)
- **THEN** the redaction processor modifies the attribute value before the span is exported to the OTEL backend

### Requirement: Graceful degradation on export failure
The system SHALL continue application operation if the OTEL endpoint is unavailable, buffering spans for later export.

#### Scenario: Export endpoint unavailable
- **WHEN** the configured OTEL endpoint is unreachable
- **THEN** the system uses an in-memory batch processor that continues application operation without logging telemetry failures

#### Scenario: Export recovers
- **WHEN** the OTEL endpoint becomes available after a previous failure
- **THEN** the system resumes normal span export without dropping buffered spans
