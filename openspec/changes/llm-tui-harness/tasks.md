## 1. Project Foundation

- [x] 1.1 Add dependencies to package.json (js-yaml, @opentelemetry/sdk-node, @opentelemetry/api, node-cron, zod, uuid)
- [x] 1.2 Create `config.yaml` with full schema (providers, sandbox, memory, telemetry, cron, sessions)
- [x] 1.3 Create zod schema definitions for all config.yaml sections
- [x] 1.4 Implement config loader that reads, validates, and merges defaults from `config.yaml`
- [x] 1.5 Implement runtime config mutation engine supporting dot-path updates via `:config set`
- [x] 1.6 Add unit tests for config validation, defaults, and mutation

## 2. Memory System

- [x] 2.1 Create `memory/`, `memory/tools/`, `memory/errors/`, `memory/context/`, `memory/schedules/` directory structure
- [x] 2.2 Implement memory file writer that creates timestamped markdown files with YAML frontmatter
- [x] 2.3 Implement memory file reader that loads and parses persisted markdown with frontmatter extraction
- [x] 2.4 Implement memory index updater that maintains `memory/_index.md` with path, title, and timestamp
- [x] 2.5 Implement memory search function that queries index frontmatter for matchable entries
- [x] 2.6 Implement context loader that reads recent files from `memory/context/`
- [x] 2.7 Implement retention policy cleaner that removes files older than `retention.days`
- [x] 2.8 Add unit tests for persistence, indexing, search, and retention

## 3. Skills Registry

- [x] 3.1 Create skill metadata types (inputSchema, outputSchema, permissions, executionContext)
- [x] 3.2 Implement skill discoverer that scans `skills/` for subdirectories with `skill.yaml` or `skill.json`
- [x] 3.3 Implement skill schema validator that validates `inputSchema` and `outputSchema` against zod
- [x] 3.4 Implement skill registry store that maintains a map of registered skills with metadata
- [x] 3.5 Implement permission resolver that merges skill-scoped permissions with default scopes
- [x] 3.6 Add unit tests for discovery, validation, and permission resolution

## 4. Sandbox RTE

- [x] 4.1 Implement sandbox runner that forks a Node.js process with `--max-old-space-size` and timeout
- [x] 4.2 Implement path resolver that checks file paths against allowed sandbox scope before granting access
- [x] 4.3 Implement URL filter that blocks `file://`, `gopher://`, `dict://` and checks against allowlist
- [x] 4.4 Implement env injector that selects only whitelisted environment variables for child process
- [x] 4.5 Implement capability enforcer that maps skill permissions to resource access rules
- [x] 4.6 Implement timeout handler that sends SIGTERM then SIGKILL to child process on expiry
- [x] 4.7 Add unit tests for path resolution, URL filtering, env injection, and capability enforcement

## 5. Telemetry (OpenTelemetry)

- [x] 5.1 Initialize OpenTelemetry provider using `@opentelemetry/sdk-node` with configurable exporter
- [x] 5.2 Implement redaction middleware that masks attributes matching `telemetry.redact.paths`
- [x] 5.3 Implement LLM instrumenter that creates spans for provider calls with token counts and latency
- [x] 5.4 Implement skill instrumenter that creates child spans for skill executions with exit status
- [x] 5.5 Implement metrics collector for `llm.usage.tokens` counter and `skill.execution.duration` histogram
- [x] 5.6 Implement sampler loader that applies configured `telemetry.sampling.ratio`
- [x] 5.7 Implement exporter flusher that runs on shutdown to drain pending spans
- [x] 5.8 Add unit tests for instrumentation, redaction, metric emission, and shutdown flush

## 6. TUI Interface

- [x] 6.8 Implement command parser that handles `:command` syntax with command dispatch table
- [x] 6.12 Add unit tests for command parser and component rendering

## 7. Session Management

- [x] 7.1 Implement session factory that generates UUID and creates initial session state
- [x] 7.2 Implement session state manager that tracks active provider, context window size, and skill context
- [x] 7.3 Implement context window enforcer that trims oldest exchanges beyond `context_window_size`
- [x] 7.4 Implement session loader that finds and parses the latest conversation file on startup
- [x] 7.5 Implement session saver that appends final exchanges to memory on shutdown
- [x] 7.6 Implement shutdown handler that flushes telemetry and closes file handles on SIGTERM/Ctrl+C
- [x] 7.7 Add unit tests for session lifecycle, context window, and shutdown

## 8. Cron Scheduler

- [x] 8.1 Implement schedule parser that reads `schedules` entries from `config.yaml` with cron validation
- [x] 8.2 Implement schedule queue that enforces `max_concurrent` limit and processes FIFO
- [x] 8.3 Implement schedule runner that executes a skill within the sandbox with inherited memory context
- [x] 8.4 Implement schedule result logger that writes outcome to `memory/schedules/` as markdown
- [x] 8.5 Implement schedule manager TUI commands (`:schedule list`, `pause`, `resume`, `run-now`)
- [x] 8.6 Implement clock tick that checks schedule expressions and enqueues triggered tasks
- [x] 8.7 Add unit tests for parsing, concurrency, execution, and logging

## 9. Integration and End-to-End

- [x] 9.1 Create `index.js` entry point that bootstraps config, registry, memory, telemetry, and TUI
- [x] 9.2 Wire LLM provider dispatch to session-managed provider with fallback chain
- [x] 9.3 Wire conversation handler to send messages through the LLM provider with memory persistence
- [x] 9.4 Wire skill invocation from TUI commands to sandbox runner with telemetry spans
- [x] 9.5 Create integration test for full conversational flow (input → provider → response → memory)
- [x] 9.6 Create integration test for skill execution through sandbox with telemetry export
- [x] 9.7 Create integration test for session lifecycle (startup → conversation → shutdown)
- [ ] 9.8 Run full lint, type-check, and test coverage gates per AGENTS.md checklist
