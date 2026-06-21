## Context

The telemetry provider (`src/telemetry/provider.js`) uses OpenTelemetry for observability. Line 4 imports `ConsoleSpanExporter` from `@opentelemetry/exporter-trace-otlp-http`, which is incorrect. The class resides in `@opentelemetry/sdk-trace-base`.

## Goals / Non-Goals

**Goals:**
- Correct the import path for `ConsoleSpanExporter`
- Ensure the import resolves correctly at runtime
- No behavioral changes to the telemetry provider

**Non-Goals:**
- No architectural changes to the telemetry system
- No new features or capabilities
- No test changes (existing tests validate the functionality)

## Decisions

- **Import source:** Use `@opentelemetry/sdk-trace-base` instead of `@opentelemetry/exporter-trace-otlp-http`
  - Rationale: `ConsoleSpanExporter` is exported from `@opentelemetry/sdk-trace-base` per the OpenTelemetry package structure. This is a straightforward correction, not a design choice.
  - Alternatives considered: None — the correct package is well-defined by the OpenTelemetry SDK.

## Risks / Trade-offs

- **Risk:** Minimal — this is a single import correction with no behavioral changes
- **Mitigation:** Existing test suite will validate no regressions