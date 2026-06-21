## Why

A code audit identified that `ConsoleSpanExporter` is imported from the wrong OpenTelemetry package in `src/telemetry/provider.js`. The import references `@opentelemetry/exporter-trace-otlp-http` when it should be `@opentelemetry/sdk-trace-base`. This is a medium-severity bug that could cause runtime errors when the console span exporter is used.

## What Changes

- Correct the import statement on line 4 of `src/telemetry/provider.js`
- Change `ConsoleSpanExporter` import from `@opentelemetry/exporter-trace-otlp-http` to `@opentelemetry/sdk-trace-base`

## Capabilities

### New Capabilities
<!-- None — this is a bug fix, not a new capability -->

### Modified Capabilities
<!-- None — no spec-level behavior changes, only implementation fix -->

## Impact

- `src/telemetry/provider.js` — import statement correction on line 4
- No API changes, no behavioral changes
- Existing tests should continue to pass