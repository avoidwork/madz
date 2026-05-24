## 1. Project Foundation

- [ ] 1.1 Add dependencies to package.json (js-yaml, @opentelemetry/sdk-node, @opentelemetry/api, node-cron, zod, uuid)
- [ ] 1.2 Create `config.yaml` with full schema (providers, sandbox, memory, telemetry, cron, sessions)
- [ ] 1.3 Create zod schema definitions for all config.yaml sections
- [ ] 1.4 Implement config loader that reads, validates, and merges defaults from `config.yaml`
- [ ] 1.5 Implement runtime config mutation engine supporting dot-path updates via `:config set`
- [ ] 1.6 Add unit tests for config validation, defaults, and mutation

## 2. Memory System

- [ ] 2.1 Create `memory/`, `memory/tools/`, `memory/errors/`, `memory/context/`, `memory/schedules/` directory structure
- [ ] 2.2 Implement memory file writer that creates timestamped markdown files with YAML frontmatter
- [ ] 2.3 Implement memory file reader that loads and parses persisted markdown with frontmatter extraction
- [ ] 2.4 Implement memory index updater that maintains `memory/_index.md` with path, title, and timestamp
- [ ] 2.5 Implement memory search function that queries index frontmatter for matchable entries
- [ ] 2.6 Implement context loader that reads recent files from `memory/context/`
- [ ] 2.7 Implement retention policy cleaner that removes files older than `retention.days`
- [ ] 2.8 Add unit tests for persistence, indexing, search, and retention

## 3. Skills Registry

- [ ] 3.1 Create skill metadata types (inputSchema, outputSchema, permissions, executionContext)
- [ ] 3.2 Implement skill discoverer that scans `skills/` for subdirectories with `skill.yaml` or `skill.json`
- [ ] 3.3 Implement skill schema validator that validates `inputSchema` and `outputSchema` against zod
- [ ] 3.4 Implement skill registry store that maintains a map of registered skills with metadata
- [ ] 3.5 Implement permission resolver that merges skill-scoped permissions with default scopes
- [ ] 3.6 Add unit tests for discovery, validation, and permission resolution

## 4. Sandbox RTE

- [ ] 4.1 Implement sandbox runner that forks a Node.js process with `--max-old-space-size` and timeout
- [ ] 4.2 Implement path resolver that checks file paths against allowed sandbox scope before granting access
- [ ] 4.3 Implement URL filter that blocks `file://`, `gopher://`, `dict://` and checks against allowlist
- [ ] 4.4 Implement env injector that selects only whitelisted environment variables for child process
- [ ] 4.5 Implement capability enforcer that maps skill permissions to resource access rules
- [ ] 4.6 Implement timeout handler that sends SIGTERM then SIGKILL to child process on expiry
- [ ] 4.7 Add unit tests for path resolution, URL filtering, env injection, and capability enforcement

## 5. Telemetry (OpenTelemetry)

- [ ] 5.1 Initialize OpenTelemetry provider using `@opentelemetry/sdk-node` with configurable exporter
- [ ] 5.2 Implement redaction middleware that masks attributes matching `telemetry.redact.paths`
- [ ] 5.3 Implement LLM instrumenter that creates spans for provider calls with token counts and latency
- [ ] 5.4 Implement skill instrumenter that creates child spans for skill executions with exit status
- [ ] 5.5 Implement metrics collector for `llm.usage.tokens` counter and `skill.execution.duration` histogram
- [ ] 5.6 Implement sampler loader that applies configured `telemetry.sampling.ratio`
- [ ] 5.7 Implement exporter flusher that runs on shutdown to drain pending spans
- [ ] 5.8 Add unit tests for instrumentation, redaction, metric emission, and shutdown flush

## 6. TUI Interface

- [ ] 6.1 Create main App component (Ink) that renders the three-panel layout (conversation, sidebar, bottom bar)
- [ ] 6.2 Implement conversation panel with virtualized message list and scroll support
- [ ] 6.3 Implement input panel with text entry and Enter-to-send
- [ ] 6.4 Implement skills panel that lists registered skills with search
- [ ] 6.5 Implement memory panel that displays index entries with file viewer
- [ ] 6.6 Implement settings panel that shows current config sections
- [ ] 6.7 Implement tab-based keyboard navigation between panels (Tab, Shift+Tab)
- [ ] 6.8 Implement command parser that handles `:command` syntax with command dispatch table
- [ ] 6.9 Implement interactive chat mode integration with LLM provider and memory persistence
- [ ] 6.10 Implement batch execution mode with step-by-step execution display
- [ ] 6.11 Implement pipeline mode with `--format json|csv` CLI flag and stdout output
- [ ] 6.12 Add unit tests for command parser and component rendering

## 7. Session Management

- [ ] 7.1 Implement session factory that generates UUID and creates initial session state
- [ ] 7.2 Implement session state manager that tracks active provider, context window size, and skill context
- [ ] 7.3 Implement context window enforcer that trims oldest exchanges beyond `context_window_size`
- [ ] 7.4 Implement session loader that finds and parses the latest conversation file on startup
- [ ] 7.5 Implement session saver that appends final exchanges to memory on shutdown
- [ ] 7.6 Implement shutdown handler that flushes telemetry and closes file handles on SIGTERM/Ctrl+C
- [ ] 7.7 Add unit tests for session lifecycle, context window, and shutdown

## 8. Cron Scheduler

- [ ] 8.1 Implement schedule parser that reads `schedules` entries from `config.yaml` with cron validation
- [ ] 8.2 Implement schedule queue that enforces `max_concurrent` limit and processes FIFO
- [ ] 8.3 Implement schedule runner that executes a skill within the sandbox with inherited memory context
- [ ] 8.4 Implement schedule result logger that writes outcome to `memory/schedules/` as markdown
- [ ] 8.5 Implement schedule manager TUI commands (`:schedule list`, `pause`, `resume`, `run-now`)
- [ ] 8.6 Implement clock tick that checks schedule expressions and enqueues triggered tasks
- [ ] 8.7 Add unit tests for parsing, concurrency, execution, and logging

## 9. Integration and End-to-End

- [ ] 9.1 Create `index.js` entry point that bootstraps config, registry, memory, telemetry, and TUI
- [ ] 9.2 Wire LLM provider dispatch to session-managed provider with fallback chain
- [ ] 9.3 Wire conversation handler to send messages through the LLM provider with memory persistence
- [ ] 9.4 Wire skill invocation from TUI commands to sandbox runner with telemetry spans
- [ ] 9.5 Create integration test for full conversational flow (input → provider → response → memory)
- [ ] 9.6 Create integration test for skill execution through sandbox with telemetry export
- [ ] 9.7 Create integration test for session lifecycle (startup → conversation → shutdown)
- [ ] 9.8 Run full lint, type-check, and test coverage gates per AGENTS.md checklist
