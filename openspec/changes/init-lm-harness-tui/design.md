## Context

The `madz` project starts from minimal scaffolding with `ink` (React for TUIs) installed, TypeScript tooling (oxlint, oxfmt, tsc), and Node.js ESM modules. The goal is to transform this into a production-grade terminal-based LLM harness that coordinates conversations, tool invocations, and automated workflows within a sandboxed environment. The application must be fully extensible via a skill registry while maintaining strict security boundaries through Docker isolation. All configuration, memory, and personality are externalized to plain-text files for version control and portability.

## Goals / Non-Goals

**Goals:**
- Single binary entry point (`index.js`) launching a responsive Ink-based TUI
- Extensible skill registry with schema-validated, permission-scoped capabilities
- Transparent markdown memory system with full auditability
- Docker-sandboxed skill execution with filesystem and network isolation
- Multi-provider LLM abstraction with fallback routing
- Self-hosting configuration with runtime modification
- OpenTelemetry integration for full observability
- Declarative cron scheduler for automated workflows
- 100% test coverage enforced via pre-commit hooks

**Non-Goals:**
- GUI or web-based interface (terminal-only)
- Support for non-Docker execution (sandbox is mandatory)
- Real-time collaborative sessions (single-user per instance)
- Built-in LLM model hosting (integration only)
- Multi-language skill execution at the adapter level (skills run in preferred language inside container)

## Decisions

### 1. TUI Framework: Ink (React) over Blessing or Commander
**Decision**: Use `ink` (already installed) with React components for all UI rendering.
**Rationale**: Ink provides component-based composition, hot reloading, and a declarative state model. Blessing is lower-level and requires more boilerplate. Commander excels at CLI flags but lacks interactive state management. Ink's React model aligns with stateful conversation flows and complex layouts (input area, message history, status bar).
**Alternatives considered**: Blessing (too low-level), Commander (CLI-only, no state), Chalk + Inquirer (fragmented, no composition).

### 2. Skill Registry Architecture: Plugin-based with Schema Validation
**Decision**: Skills are registered via YAML/JSON config files in `skills/<skill-name>/` directories with a `scripts/` subdirectory for execution assets. A central `tools-registry.js` loads, validates, and indexes all skills on startup using zod schemas.
**Rationale**: File-based registration is discoverable, version-controllable, and allows onboarding without code changes. Zod validation at load time catches misconfigurations before runtime. Separating the registry core from skill definitions enables plugin endpoints and runtime discovery.
**Alternatives considered**: Hardcoded skill definitions (not extensible), database-backed registry (overkill for file-based system), dynamic `require()` (security risk with eval-like patterns).

### 3. Memory System: Markdown Files over Database
**Decision**: Persist conversation history, tool outputs, and context as plain markdown files in `memory/` with subdirectories (`conversations/`, `tools/`, `context/`, `logs/`).
**Rationale**: Markdown is human-readable, diffable, and version-controllable. File-based storage avoids database dependencies and enables full cross-session recall. JSON frontmatter headers store metadata (timestamps, skill names, token counts) while the body contains the content.
**Alternatives considered**: SQLite (adds dependency, less portable), Redis (not persistent in dev, external service), MongoDB (contradicts lightweight philosophy).

### 4. Sandboxing: Docker with Volume Mounts
**Decision**: Each skill execution spawns a container from a multi-language Dockerfile (Node.js + Python). Filesystem access is restricted via `memory/` and `config.yaml` mounts. Network access is optional and permission-scoped per skill.
**Rationale**: Docker provides well-understood isolation primitives (namespaces, cgroups, AppArmor). Volume mounts grant selective host access without exposing the full filesystem. Network policies are enforced via Docker flags per skill capability. The RTE Dockerfile supports both runtimes natively.
**Alternatives considered**: Containership/Nix (narrower ecosystem), namespaces only (weaker isolation, Docker-incompatible), podman (not universally available).

### 5. LLM Provider Abstraction: Unified Adapter Interface
**Decision**: All providers implement a `ProviderAdapter` interface (`chat()`, `complete()`, `stream()`) with a factory that selects providers from `config.yaml`. The factory supports fallback chains and per-request routing by provider name or heuristic (cost, latency).
**Rationale**: Decouples application logic from provider-specific APIs. Configuration-driven provider selection allows runtime switching. Unified response normalization (message, tokens, latency) enables consistent telemetry and memory logging.
**Alternatives considered**: Provider-specific nodes throughout (coupled, harder to test), third-party SDK layer (adds indirection, overhead).

### 6. Configuration: Single config.yaml with Runtime Modification
**Decision**: All system configuration lives in `config.yaml` — providers, sandbox params, memory policy, skill permissions, scheduler entries, telemetry settings. A `ConfigManager` class reads/writes the file and emits change events for hot-reload.
**Rationale**: Single source of truth simplifies portability and sharing. Runtime modification via the TUI (`/config <key> <value>`) or programmatic setter enables dynamic adjustment without restart. YAML is human-readable and supports comments. Change events allow subscribers (sandbox, scheduler, telemetry) to react immediately.
**Alternatives considered**: `.env` files (no structure), JSON (no comments), YAML + env (dual sources, confusion).

### 7. Telemetry: OpenTelemetry SDK with Span Instrumentation
**Decision**: Use `@opentelemetry/sdk-node` with manual span instrumentation. Spans wrap every LLM call, skill execution, and memory operation. Metrics capture token counts, latency, error rates, and memory sizes. Sensitive data is redacted via a configurable processor before export.
**Rationale**: OpenTelemetry is the industry standard for observability, enabling export to any backend (Jaeger, Datadog, Prometheus). Manual span control (vs auto-instrumentation) is necessary for custom operations (skill execution, memory writes). Redaction processor prevents credentials or PII in traces.
**Alternatives considered**: Winston/Pino only (no distributed tracing), custom metrics (rebuilds existing standards).

### 8. Scheduler: Node-cron-based Declarative Scheduling
**Decision**: Use a cron expression parser with a declarative `schedules` section in `config.yaml`. Each entry maps a cron expression to a skill name, optional memory context, and output destination (markdown log, TUI notification, telemetry event). The scheduler runs in a separate thread within the process, not as a background daemon.
**Rationale**: Declarative config is version-controllable. Thread-based scheduling (not a separate process) keeps the architecture simple while providing deterministic timing. Inherited permissions and memory context ensure scheduled runs respect security boundaries.
**Alternatives considered**: System crontab (host-dependent, not portable), a separate worker process (complexity), async retry loops (imprecise timing).

## Risks / Trade-offs

[Risk] Docker dependency increases deployment complexity and requires Docker daemon access. → [Mitigation] Document Docker prerequisites. Provide a `--dev` flag that bypasses sandbox for local development with explicit warning. Container image is optimized (~300MB multi-stage build).

[Risk] Markdown memory files grow unbounded over time. → [Mitigation] Configurable retention policy in `config.yaml` (`memory.retention.days`, `memory.retention.maxFiles`). Background cleanup job purges expired entries. Search indexes by date and skill name for navigation.

[Risk] Runtime configuration modification could cause inconsistent state if two sources write simultaneously. → [Mitigation] Single-threaded writes via `ConfigManager` with file-level locking. Write operations use atomic rename (write to temp, then `fs.rename`). Change events batch updates.

[Risk] Skill execution scope could be gamed through crafted skill configs. → [Mitigation]: Schema validation at load time. Network access per-skill via Docker network policies. Filesystem limited to mounted volumes. Process CPU/memory limits via Docker resource constraints. Admin approval required for `network: true` skills.

[Risk] Multi-provider abstraction adds maintenance burden for each new provider. → [Mitigation]: Provider adapter interface is minimal (3 methods). Shared utilities handle common tasks (auth, retry, streaming). Each provider requires ~100-200 lines of implementation. New providers are registered in `config.yaml` — no code changes to core.

[Risk] OpenTelemetry export could fail silently, losing observability data. → [Mitigation]: Batch span processor with configurable export interval. Export failures log to memory instead of dropping spans. Graceful degradation: application continues if OTEL endpoint is unavailable.
