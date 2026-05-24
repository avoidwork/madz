## Why

The project currently has individual skills but lacks a unified terminal-based interface for users to interact with the LLM harness, manage sessions, chain tool invocations, and execute scheduled tasks. Users need a keyboard-driven TUI that serves as an intelligent workflow coordinator rather than a simple chat wrapper, with persistent markdown memory, sandboxed skill execution, and full observability through OpenTelemetry.

## What Changes

- **TUI Interface**: Build a keyboard-driven terminal UI using `ink` (React for TUI) with three interaction modes — interactive chat, batch execution, and pipeline-friendly output — featuring tab-based navigation between conversation, memory, and skills panels.
- **Skills Registry**: Create a centralized discovery and validation system that scans the `skills/` directory for skill definitions, validates input schemas, and exposes capabilities to the harness.
- **Memory System**: Implement file-based markdown persistence for conversation history, tool outputs, user-supplied context, and execution logs with cross-session recall and version-control readiness.
- **Sandbox RTE**: Introduce an isolated runtime environment for skill execution with process sandboxing, capability restrictions, and controlled filesystem/network access.
- **Config System**: Add centralized `config.yaml` supporting LLM providers (OpenAI-compatible, local models, custom cloud endpoints), sandbox parameters, memory retention, skill permissions, and scheduling rules.
- **Telemetry Integration**: Add OpenTelemetry tracing and metrics for all LLM interactions, skill executions, and sandbox operations with configurable sampling, endpoint exports, and sensitive data redaction.
- **Cron Scheduler**: Build a declarative schedule system for recurring skill execution with deterministic sandboxes and markdown-logged results.
- **Session Management**: Track per-session state, context window boundaries, and provider assignments with programmatic runtime modification support.

## Capabilities

### New Capabilities

- `tui-interface`: Terminal-based keyboard-driven UI with interactive chat, batch execution, and pipeline output modes
- `skills-registry`: Centralized skill discovery, schema validation, and capability scoping from the `skills/` directory
- `memory-system`: File-based markdown persistence for conversation history, tool outputs, and execution logs
- `sandbox-rte`: Isolated runtime environment with process sandboxing and controlled access boundaries
- `config-system`: Centralized YAML configuration for providers, sandbox settings, memory, skills, and scheduling
- `telemetry`: OpenTelemetry integration for distributed tracing, metrics, and observability across all operations
- `cron-scheduler`: Declarative cron-based task scheduling with deterministic sandbox execution
- `session-management`: Per-session state tracking, context management, and runtime config mutation

### Modified Capabilities

<!-- None — all capabilities are new -->

## Impact

- **Affected code**: `src/` application modules (TUI components, graph runner, skill execution engine, sandbox), `config.yaml` schema, memory directory structure
- **APIs**: Provider abstraction layer for LLM inference, skill execution RPC, memory CRUD, telemetry span export
- **Dependencies**: `ink` for TUI rendering, `@opentelemetry/sdk-node` for telemetry, `@opentelemetry/api` for instrumentation, `js-yaml` for config parsing, `cron-parser` for scheduling, `zod` for schema validation
- **Systems**: Skills registry must scan existing `skills/*/scripts/` structure; memory persists to `memory/`; sandbox uses forked processes with capability restrictions; telemetry exports via OTEL protocols
