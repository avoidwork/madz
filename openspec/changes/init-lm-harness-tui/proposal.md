## Why

The project needs a complete TUI-based LLM harness application that serves as an intelligent workflow coordinator rather than a simple chat wrapper. Current state has only project scaffolding with TypeScript tooling and the `ink` library installed. A cohesive architecture is required to unify terminal UI, tool registry, memory system, sandboxing, provider adapters, configuration management, scheduling, and telemetry into a single extensible platform.

## What Changes

- Implement a keyboard-driven TUI using Ink/React for conversational and batch interaction modes
- Build a centralized tools and skills registry with schema validation, capability scoping, and dynamic discovery
- Create a transparent file-based markdown memory system for conversation history, tool outputs, and execution logs
- Define SOUL.md as the personality and operational guidelines configuration
- Integrate a Docker-based sandboxed runtime environment (RTE) with filesystem isolation, network limitations, and process boundaries
- Build multi-provider LLM adapter supporting OpenAI, OpenAI-compatible endpoints, and local deployments
- Implement centralized YAML configuration (`config.yaml`) with runtime self-modification capabilities
- Add OpenTelemetry integration for distributed tracing and metrics across all interactions
- Integrate a cron scheduler for automated, time-based skill execution
- Establish strict phase-gated validation with 100% coverage unit and integration tests

## Capabilities

### New Capabilities

- `tui-interface`: Terminal UI with keyboard-driven interaction for ad-hoc conversations, batch execution, and pipeline output modes
- `tools-registry`: Centralized skill/tool registry with schema validation, permission scoping, dynamic discovery, and plugin endpoints for local and remote capabilities
- `memory-system`: File-based markdown memory persistence including conversation history, tool output logs, user-supplied context, and version-controllable state
- `sandbox`: Docker-based sandboxed runtime environment enforcing filesystem isolation, network boundaries, and process containment with selective writable volumes
- `provider-adapter`: Multi-provider LLM adapter supporting OpenAI, OpenAI-compatible APIs, and local model deployments with fallback routing and rate limits
- `config-manager`: Centralized YAML configuration system with runtime self-modification, provider definitions, sandbox parameters, and telemetry settings
- `scheduler`: Declarative cron-based scheduler for automated skill execution with inherited security boundaries and memory context
- `telemetry`: OpenTelemetry integration for distributed tracing and metrics collection capturing token usage, latency, tool costs, error rates, and memory states

### Modified Capabilities

- None (project is in initial scaffolding state)

## Impact

- **New directories**: `src/` (application code), `src/tools/` (skill registry), `src/memory/` (markdown store), `src/sandbox/` (Docker RTE), `src/providers/` (LLM adapters), `src/tui/` (UI components), `src/config/` (configuration management), `src/scheduler/` (cron system), `src/telemetry/` (OTEL), `skills/` (skill definitions), `memory/` (markdown store), `tests/` (unit and integration tests)
- **Configuration files**: `config.yaml` (runtime config), `SOUL.md` (personality), `.dockerignore`, `Dockerfile` (sandbox)
- **Dependencies**: Docker SDK for Node.js, YAML parser, OpenTelemetry SDKs, Ink-related dependencies, testing tools
- **Breaking changes**: None — this is initial project scaffolding with no prior application code
- **External systems**: Docker daemon, LLM API providers (configurable), OTEL collector endpoints
