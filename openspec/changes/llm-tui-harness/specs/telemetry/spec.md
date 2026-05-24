## ADDED Requirements

### Requirement: Distributed Tracing
The system SHALL create and export OpenTelemetry spans for every LLM inference call, skill execution, and sandbox operation, capturing start time, end time, parent-child relationships, and status.

#### Scenario: LLM call creates a trace span
- **WHEN** the harness invokes an LLM provider
- **THEN** the system creates a span with attributes for provider name, model, input token count, and output token count

#### Scenario: Skill execution creates a trace span
- **WHEN** the harness executes a skill
- **THEN** the system creates a child span of the current invocation span with attributes for skill name, duration, and exit status

### Requirement: Metrics Collection
The system SHALL export OpenTelemetry metrics for token usage, latency percentiles, tool execution costs, error rates, and memory persistence states.

#### Scenario: Token usage metric is emitted
- **WHEN** an LLM inference completes
- **THEN** the system increments the `llm.usage.tokens` counter for input and output dimensions

#### Scenario: Latency histogram records skill duration
- **WHEN** a skill execution finishes
- **THEN** the system records the execution duration in the `skill.execution.duration` histogram

### Requirement: Sampling Configuration
The system SHALL support configurable trace sampling rates defined in `config.yaml` under `telemetry.sampling.ratio` (0.0 to 1.0).

#### Scenario: 1% sampling rate is applied
- **WHEN** `telemetry.sampling.ratio` is set to `0.01`
- **THEN** the sampler retains only 1% of spans deterministically

#### Scenario: 100% sampling rate is applied
- **WHEN** `telemetry.sampling.ratio` is set to `1.0`
- **THEN** all spans are retained

### Requirement: Exporter Configuration
The system SHALL support multiple OTEL exporters (console, OTLP HTTP, OTLP gRPC) with configurable endpoints and batch sizes defined in `config.yaml`.

#### Scenario: OTLP HTTP exporter is configured
- **WHEN** `config.yaml` sets `telemetry.exporter.protocol: http` and `telemetry.exporter.endpoint: http://collector:4318`
- **THEN** the system initializes an HTTP-based OTLP trace exporter targeting the specified endpoint

#### Scenario: Export queue flushes on shutdown
- **WHEN** the harness receives a SIGTERM signal
- **THEN** the system flushes any pending spans in the exporter queue before exiting

### Requirement: Data Redaction
The system SHALL redact sensitive field values (API keys, tokens, secrets) from all span attributes and metric labels before they reach an exporter.

#### Scenario: API key is redacted from LLM span
- **WHEN** an LLM invocation span includes an attribute containing an API key
- **THEN** the key value is replaced with `[REDACTED]` before the span is exported

#### Scenario: Redaction is configured via allowlist
- **WHEN** `telemetry.redact.paths` lists specific dotted paths to redact
- **THEN** attributes matching those paths are masked at instrumentation time
