## Context

The `madz` project is a Node.js AI harness with 5 existing skills (`api-request`, `env-query`, `fs-read`, `host-info`, `process-run`) each with a `scripts/` subdirectory. It uses `ink` for TUI rendering and follows conventional commits, strict linting, and 100% test coverage. The project already has a `memory/` directory and `.opencode/` configuration but lacks a unified interface, centralized configuration, skill registry, sandbox isolation, telemetry, and scheduling.

Users need a single entrypoint to interact with the LLM harness — a keyboard-driven terminal UI that orchestrates conversation, skill execution, memory management, and scheduled tasks within a sandboxed runtime.

## Goals / Non-Goals

**Goals:**
- Deliver a functional TUI with chat, batch, and pipeline modes using `ink`
- Implement skills registry that discovers and validates all `skills/*/` entries
- Persist conversation and execution state as markdown in `memory/`
- Sandbox all skill execution via forked processes with capability restrictions
- Centralize provider, sandbox, memory, and schedule configuration in `config.yaml`
- Integrate OpenTelemetry for tracing LLM calls, skill runs, and sandbox operations
- Provide a cron-based scheduler for recurring skill workflows
- Track per-session state with runtime config mutation support

**Non-Goals:**
- Web-based or GUI interface (terminal-only)
- Nested/recursive sandbox execution (RTE is not a VM)
- Multi-tenant or user-permission model (single-user assumption)
- Real-time streaming fallbacks outside OTEL (tracing only)
- Container/Docker packaging (deployable via Docker but packaging is out of scope)

## Decisions

### Decision 1: TUI Rendering via Ink (React for TUI)
**Choice**: Use `ink` (already a dependency) with React components for all UI rendering.
**Rationale**: Already in `package.json` dependencies. React-based component model enables declarative, testable UI code. Alternatives like `blessed` or `blessed-contrib` were considered but would require dropping the existing dependency and rewriting all component logic.

### Decision 2: Skill Discovery via Directory Scanning
**Choice**: Register skills by scanning `skills/` for subdirectories, each containing a `scripts/` folder. Load skill metadata from a `skill.yaml` or `skill.json` file in each skill root.
**Rationale**: Matches the existing filesystem layout. Schema validation via `zod` ensures input contracts without code changes. Alternatives like a flat registry file would require manual sync and don't support hot-discovery.

### Decision 3: Sandbox via Forked Node Processes with Resource Limits
**Choice**: Execute skills by forking a new Node.js process with constrained memory, CPU, and network access via Node.js `--max-old-space-size` and capabilities. Block `file://`, `gopher://`, `dict://` URL schemes in outbound requests.
**Rationale**: Process-level isolation with Node.js built-in flags avoids Docker overhead for local development. Nested execution is out of scope. Alternatives like Web Workers lack native process boundaries and would share the same Node.js memory space.

### Decision 4: Config via YAML with Runtime Mutability
**Choice**: Single `config.yaml` file for all settings (providers, sandbox, memory, skills, telemetry, scheduling). Runtime mutation supported via TUI command (`:config set <key> <value>`).
**Rationale**: YAML is human-readable and version-controllable as stated in requirements. Runtime mutability requires YAML to remain parseable as plain text. Alternatives like JSON lack comments; TOML is less familiar to the target audience.

### Decision 5: Memory Persistence as Markdown Files
**Choice**: Write all conversation history, tool outputs, and execution logs as timestamped markdown files in `memory/`. Index via a `memory/index.mdx` or `memory/_index.md` with YAML frontmatter.
**Rationale**: Markdown is human-readable, delta-versionable via Git, and satisfies the "transparent audit" requirement. Alternatives like a database would break the version-control parity goal.

### Decision 6: OTEL via @opentelemetry/sdk-node
**Choice**: Use `@opentelemetry/sdk-node` with a configurable exporter (console, OTLP HTTP, or OTLP gRPC) defined in `config.yaml`. Redact sensitive fields (API keys, tokens) in spans and metrics.
**Rationale**: SDK-node bundles trace provider, resource detector, and exporters. Redaction middleware prevents data leaks. Alternatives like manually wiring OTel components add fragility.

### Decision 7: Cron Scheduler via node-cron
**Choice**: Use `node-cron` for scheduling declarative skill runs defined in `config.yaml`. Each run inherits sandbox, memory context, and permissions from the current session.
**Rationale**: Declarative schedule configs match the YAML-first approach. Alternatives like system cron lack per-run memory context and would require complex shell glue.

## Risks / Trade-offs

### Risk: Ink Component Complexity at Scale
TUIs built with React components can become harder to debug than DOM-based apps. Rendering performance degrades with large message histories.
**Mitigation**: Virtualize long conversation lists. Implement a `VirtualList` component that only renders visible lines. Cap conversation window to last N messages configurable in memory.

### Risk: Sandbox Bypass via Forked Process
Forked processes still share the same host filesystem and network stack. Determined users could escape via `/proc` access or symlink attacks.
**Mitigation**: Restrict filesystem access to explicitly mapped sandbox paths. Use `chroot`-like path prefix checks. Validate all file paths against allowlists before granting access to skill scripts.

### Risk: Config.yaml Schema Drift
Without schema enforcement, users may misconfigure providers or telemetry settings, causing runtime failures.
**Mitigation**: Validate all `config.yaml` sections against zod schemas on boot and on runtime mutation. Return clear error messages with expected structure. Persist only validated configs.

### Risk: OTEL Export Blocking
If the OTEL exporter endpoint is unreachable or slow, span flushing can block the event loop and stall the TUI.
**Mitigation**: Configure `scheduledDelayMillis` and `timeout` on the exporter. Run the trace exporter on a separate scheduling tick. Add circuit-breaker logic to skip exports after consecutive failures.

### Risk: Cron Scheduler Conflicts
Scheduled runs may overlap with user-initiated runs, consuming shared resources or producing conflicting state.
**Mitigation**: Queue scheduled runs with a maximum concurrent limit (default: 1). Log conflicts in memory. Add `:schedule pause` and `:schedule resume` TUI commands for manual control.
