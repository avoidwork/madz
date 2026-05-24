## 1. Project Setup and Configuration

- [ ] 1.1 Create project directory structure under src/ (tui, tools, memory, sandbox, providers, config, scheduler, telemetry)
- [ ] 1.2 Create config.yaml with default configuration for providers, sandbox, memory, telemetry, and scheduler
- [ ] 1.3 Create SOUL.md with safe default personality definition
- [ ] 1.4 Add project dependencies to package.json (dockerode, js-yaml, @opentelemetry packages, zod, node-cron)
- [ ] 1.5 Create default config fallback generator for missing config.yaml
- [ ] 1.6 Add .dockerignore for project root

## 2. Config Manager Implementation

- [ ] 2.1 Implement ConfigManager class with YAML parse/write and change event emitter
- [ ] 2.2 Implement config schema validation with zod for config.yaml structure
- [ ] 2.3 Implement environment variable interpolation (`${ENV_VAR}` syntax)
- [ ] 2.4 Implement atomic file writes using temp file + fs.rename
- [ ] 2.5 Implement hot-reload subscription mechanism for config change events
- [ ] 2.6 Write unit tests for ConfigManager (valid config, invalid config, interpolation, atomic writes, hot-reload)

## 3. Memory System Implementation

- [ ] 3.1 Create memory directory structure under memory/ (conversations/, tools/, context/, logs/)
- [ ] 3.2 Implement markdown file writer with frontmatter metadata (timestamp, type, tags)
- [ ] 3.3 Implement conversation manager (create, append, list, switch, clear sessions)
- [ ] 3.4 Implement tool log writer (skill name, input, output, duration, tokens)
- [ ] 3.5 Implement context manager (create, read, index, reference via /context command)
- [ ] 3.6 Implement SOUL.md loader with safe defaults fallback and hot-reload
- [ ] 3.7 Implement memory retention cleanup job with configurable retention.days and maxFiles
- [ ] 3.8 Write unit tests for memory system (conversation CRUD, tool logging, context management, SOUL.md, retention)

## 4. Tools Registry Implementation

- [ ] 4.1 Create sample skill directory structure in skills/ (e.g., skills/fs-read/scripts, skills/process-kill/scripts)
- [ ] 4.2 Implement skill config schema validation with zod
- [ ] 4.3 Implement skill directory discovery (scan skills/ for config.yaml)
- [ ] 4.4 Implement SkillRegistry class with register(), get(), list(), unregister() methods
- [ ] 4.5 Implement permission scope model (filesystem, network, process, cpu, memory)
- [ ] 4.6 Implement plugin endpoint API for runtime skill registration
- [ ] 4.7 Implement hot-reload via file watcher and /reload-skills command
- [ ] 4.8 Write unit tests for tools registry (discovery, validation, registration, unregistration, plugin API)

## 5. Sandbox Implementation

- [ ] 5.1 Create Dockerfile for multi-language RTE image (Node.js + Python)
- [ ] 5.2 Implement container engine wrapper (dockerode client) with image build/cleanup
- [ ] 5.3 Implement bind-mount configuration (memory/, config.yaml, skill scripts)
- [ ] 5.4 Implement network policy enforcement (allowlist for outbound URLs, block file:// gopher:// dict://)
- [ ] 5.5 Implement resource limit configuration (CPU, memory, process count)
- [ ] 5.6 Implement skill execution orchestrator (create container → mount volumes → exec script → collect output → cleanup)
- [ ] 5.7 Implement timeout handling for skill execution (configurable per-skill, default 5 minutes)
- [ ] 5.8 Write unit tests for sandbox (container creation, mount config, timeout, output collection) and integration tests with mock dockerode

## 6. Provider Adapter Implementation

- [ ] 6.1 Define ProviderAdapter interface with chat(), complete(), stream() methods and response normalizer
- [ ] 6.2 Implement OpenAI provider adapter (HTTP fetch with SSE streaming, auth via apiKey header)
- [ ] 6.3 Implement local model provider adapter (REST and WebSocket streaming support)
- [ ] 6.4 Implement ProviderFactory with provider selection and fallback chain logic
- [ ] 6.5 Implement rate limiter per provider (token bucket algorithm, configurable requestsPerMinute)
- [ ] 6.6 Implement response normalizer that converts provider-specific responses to common format
- [ ] 6.7 Write unit tests for provider adapter (chat, streaming, fallback, rate limiting, normalization)

## 7. TUI Interface Implementation

- [ ] 7.1 Create Ink App component as the root application component with state management
- [ ] 7.2 Implement message history component with scrollable list and virtualization for long histories
- [ ] 7.3 Implement input prompt component with keyboard navigation (up arrow history, tab completion)
- [ ] 7.4 Implement status bar (current provider, model, token count, active skill)
- [ ] 7.5 Implement streaming response renderer for real-time token display
- [ ] 7.6 Implement command parser for slash commands (/help, /provider, /new, /memory, /config, /context)
- [ ] 7.7 Implement batch mode entry point (node index.js --batch task.yaml --output json)
- [ ] 7.8 Implement window resize handler for graceful reflow
- [ ] 7.9 Write unit tests for TUI components (message history, input prompt, status bar, command parser) using Ink testing utils

## 8. Scheduler Implementation

- [ ] 8.1 Implement schedule parser with cron expression validation using node-cron
- [ ] 8.2 Implement schedule registry (register from config.yaml, toggle enable/disable, list)
- [ ] 8.3 Implement schedule executor that invokes skills with memory context and sandbox parameters
- [ ] 8.4 Implement schedule result logger to memory/logs/ directory
- [ ] 8.5 Implement TUI commands for schedule management (/schedule list, /schedule enable, /schedule disable)
- [ ] 8.6 Write unit tests for scheduler (cron parsing, schedule registration, executor, result logging)

## 9. Telemetry Implementation

- [ ] 9.1 Initialize OpenTelemetry SDK with configurable exporter (OTLP HTTP)
- [ ] 9.2 Implement span instrumentation for LLM interactions (chat, complete, stream)
- [ ] 9.3 Implement span instrumentation for skill execution (before/after hooks in sandbox executor)
- [ ] 9.4 Implement span instrumentation for memory operations (write, cleanup)
- [ ] 9.5 Implement metrics: token count, operation latency histogram, error count counter
- [ ] 9.6 Implement data redaction processor for sensitive attribute patterns
- [ ] 9.7 Implement configurable sampling with in-memory fallback batch processor
- [ ] 9.8 Write unit tests for telemetry (span creation, metrics recording, redaction, graceful degradation)

## 10. Sample Skills

- [ ] 10.1 Create sample local skill: fs-read (read file with size limit, path validation)
- [ ] 10.2 Create sample local skill: process-run (execute command with timeout and output capture)
- [ ] 10.3 Create sample local skill: env-query (read environment variables, filtered by pattern)
- [ ] 10.4 Create sample local skill: host-info (system info: OS, CPU, memory, disk usage)
- [ ] 10.5 Create sample remote skill: api-request (HTTP request with URL allowlist validation)
- [ ] 10.6 Test each sample skill end-to-end within the sandbox

## 11. Integration Testing and Hardening

- [ ] 11.1 Create integration test for full conversation flow (TUI → provider → memory → response)
- [ ] 11.2 Create integration test for skill execution pipeline (registry → sandbox → result logging)
- [ ] 11.3 Create integration test for sandbox boundary enforcement (filesystem, network, process isolation)
- [ ] 11.4 Create integration test for config hot-reload propagation to subsystems
- [ ] 11.5 Create integration test for telemetry data export with redaction
- [ ] 11.6 Create integration test for scheduler triggering skill on cron match
- [ ] 11.7 Create integration test for provider fallback chain on primary failure
- [ ] 11.8 Run full test suite with coverage check, fix gaps until 100% coverage achieved

## 12. Build, Docker, and Packaging

- [ ] 12.1 Create production Dockerfile for the TUI application host
- [ ] 12.2 Create RTE Dockerfile for sandbox skill execution
- [ ] 12.3 Implement build script for RTE image with multi-stage compilation
- [ ] 12.4 Add pre-commit hook verification for RTE Dockerfile build
- [ ] 12.5 Test end-to-end pipeline: build RTE → build host → run TUI → execute skill → verify telemetry
