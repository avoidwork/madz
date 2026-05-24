## 1. Project Setup & Infrastructure

- [ ] 1.1 Create project directory structure (`bin/`, `src/`, `src/tui/`, `src/tools/`, `src/memory/`, `src/sandbox/`, `src/session/`, `src/config/`, `src/adapters/`, `src/logging/`, `src/commands/`, `tests/unit/`, `tests/integration/`)
- [ ] 1.2 Configure `package.json` with `type: "module"`, scripts, and dependencies (`ink`, `@react-dev/tools`, `zod`, `winston` or custom JSON logger, `dockerode`, `minimist`)
- [ ] 1.3 Update `AGENTS.md` section 2.0 (project layout) and 2.1 (quick commands) with new directory structure
- [ ] 1.4 Create `Dockerfile.sandboxes` for the sandbox container image (minimal, non-root user, pre-installed CLI tools)
- [ ] 1.5 Create `.dockerignore`, `.gitignore`, and `.editorconfig` for the project
- [ ] 1.6 Implement `AppError` class with error code hierarchy (`src/errors.js`)
- [ ] 1.7 Implement JSDoc-compliant utility functions (PII redaction, line counting, date formatting) in `src/utils/`

## 2. System Configuration (system-config)

- [ ] 2.1 Create zod validation schema for config in `src/config/schema.js` covering all fields: `memoryDir`, `sandbox`, `session`, `tools`, `log`, `llm`
- [ ] 2.2 Create default settings object in `src/config/defaults.js` with secure production-safe defaults (`log.level: "info"`, `sandbox.enabled: true`, empty allowlist)
- [ ] 2.3 Create settings singleton loader in `src/config/loader.js` that reads JSON/JSONC from configurable path, validates against zod, and exports a frozen singleton
- [ ] 2.4 Create `--init-config` CLI flag handler that writes a sample `config.json` with default values and inline comment descriptions
- [ ] 2.5 Implement runtime config reload: create `src/config/reload.js` that re-loads from disk, re-validates, and swaps the singleton; retain previous config on validation failure
- [ ] 2.6 Implement SOUL.md loader in `src/config/soul.js`: reads from `memoryDir/SOUL.md`, creates secure default if missing, caches content for LLM injection
- [ ] 2.7 Write unit tests for config loader (`tests/unit/config/loader.test.js`) covering valid config load, invalid config rejection, custom path loading
- [ ] 2.8 Write unit tests for zod schema validation (`tests/unit/config/schema.test.js`) covering all field constraints and type checks
- [ ] 2.9 Write unit tests for SOUL.md loader (`tests/unit/config/soul.test.js`) covering existing file load and default file creation

## 3. Logging Infrastructure

- [ ] 3.1 Implement structured JSON logger in `src/logging/writer.js` supporting stdout and file targets (configurable via `log.output`)
- [ ] 3.2 Implement PII redaction utility in `src/logging/redactor.js` using regex patterns for passwords, tokens, API keys, credit card numbers
- [ ] 3.3 Integrate logger into the settings initialization (log level applies at startup)
- [ ] 3.4 Write unit tests for PII redactor (`tests/unit/logging/redactor.test.js`)
- [ ] 3.5 Write unit tests for structured logger (`tests/unit/logging/writer.test.js`)

## 4. File-Based Memory (file-based-memory)

- [ ] 4.1 Create memory entry writer in `src/memory/writer.js` with append-only semantics; implement serialization to prevent concurrent writes
- [ ] 4.2 Implement markdown append format: `### User`, `### Assistant`, `### Tool: <name>` headings with timestamps, descriptions, and code-block-embedded outputs
- [ ] 4.3 Create memory context reader in `src/memory/reader.js` that reads session files and returns lines/entries with configurable line limits
- [ ] 4.4 Implement memory truncation in `src/memory/truncate.js`: when active file exceeds `maxContextLines`, keep newest entries, create backup in `memory/.backups/<timestamp>.md`
- [ ] 4.5 Implement memory injection in `src/memory/inject.js`: combines active session file and any `/add-context` entries into a structured context string for LLM prompting
- [ ] 4.6 Create session listing utility in `src/memory/lookup.js` that scans the memory directory and returns metadata (ID, date, line count) for past sessions
- [ ] 4.7 Implement git-integrated commit command in `src/memory/git.js`: runs `git add` and `git commit` with conventional commit message on memory and config paths
- [ ] 4.8 Write unit tests for memory writer (`tests/unit/memory/writer.test.js`)
- [ ] 4.9 Write unit tests for memory reader with truncation (`tests/unit/memory/reader.test.js`)
- [ ] 4.10 Write unit tests for backup creation (`tests/unit/memory/truncate.test.js`)

## 5. Docker Sandbox (sandbox)

- [ ] 5.1 Create Docker container manager in `src/sandbox/manager.js` with lifecycle methods: `start()`, `stop()`, `restart()`, `healthCheck()`
- [ ] 5.2 Implement container creation with strict isolation flags: `--read-only`, `--cap-drop=ALL`, `--security-opt=no-new-privileges`, `--user=nonroot:nonroot`, volume mounts for `memoryDir` and settings
- [ ] 5.3 Implement container health check: ping container exec, update container status in session state
- [ ] 5.4 Implement pre-execution health verification: before every tool/inference call, verify container health; if unhealthy, attempt restart then proceed or fail
- [ ] 5.5 Create signal handler in `src/sandbox/handler.js` that catches SIGTERM/SIGINT, stops container, exits gracefully
- [ ] 5.6 Implement `--no-sandbox` mode: skip Docker startup, log safety warning `"SAFETY: Running in no-sandbox mode — all isolation features disabled."` at startup
- [ ] 5.7 Create file operations wrapper in `src/sandbox/fileOps.js`: executes `docker exec` for read/write/list, validates paths are within mounted volumes, enforces `maxReadSize` limit
- [ ] 5.8 Create shell command runner in `src/sandbox/shell.js`: executes commands via `docker exec`, enforces timeout from settings, returns structured output and exit code
- [ ] 5.9 Create network restriction layer in `src/sandbox/network.js`: implements domain allowlist validation before making outbound HTTP requests (also covers the tool-registry allowlist requirement)
- [ ] 5.10 Implement leak prevention: use tmpfs for all non-volumne writes inside container, audit filesystem after sessions
- [ ] 5.11 Write unit tests for Docker manager (`tests/unit/sandbox/manager.test.js`) — mock dockerode
- [ ] 5.12 Write unit tests for file operations validation (`tests/unit/sandbox/fileOps.test.js`)

## 6. Tool Registry (tool-registry)

- [ ] 6.1 Create tool definition zod schema in `src/tools/schema.js`: validates `name` (string), `description` (string), `schemaFn` (function returning zod schema), `execute` (async function), `destructive` (boolean)
- [ ] 6.2 Create tool registry in `src/tools/registry.js`: supports `register(toolDef)`, `get(name)`, `list()`, `remove(name)` with validation and runtime add/remove
- [ ] 6.3 Implement input validation wrapper in `src/tools/validate.js`: runs zod schema before dispatch, returns structured field errors, applies PII redaction to error messages
- [ ] 6.4 Implement approval gate system in `src/tools/approvals.js`: intercepts destructive tool calls in TUI mode, displays prompt with tool details, returns approval decision to session manager
- [ ] 6.5 Implement batch-mode bypass in `src/tools/approvals.js`: in batch/pipeline mode, skip approval and log `[WARNING] destructive tool executed in batch mode: <name>`
- [ ] 6.6 Create built-in tools:
  - [ ] 6.6.1 File read tool: executes via sandbox `fileOps.read()`, respects `maxReadSize`, validates allowlisted paths
  - [ ] 6.6.2 File write tool: destructive, executes via sandbox `fileOps.write()`, validates allowlisted paths
  - [ ] 6.6.3 File list tool: executes via sandbox `fileOps.ls()`
  - [ ] 6.6.4 Shell execute tool: destructive, executes via sandbox `shell.run()`, enforces timeout
  - [ ] 6.6.5 HTTP fetch tool: executes via sandbox network layer, validates URL scheme and domain allowlist
  - [ ] 6.6.6 Transform tool: data transformation utility (JSON encode/decode, base64, CSV parse/generate) — non-destructive
  - [ ] 6.6.7 Web search tool: executes via sandbox HTTP fetch to allowlisted search endpoints
- [ ] 6.7 Create tool execution logger in `src/tools/logger.js`: wraps tool execution, measures duration, produces structured JSON log with PII-redacted input/output
- [ ] 6.8 Write unit tests for tool registry (`tests/unit/tools/registry.test.js`)
- [ ] 6.9 Write unit tests for input validation (`tests/unit/tools/validate.test.js`)
- [ ] 6.10 Write unit tests for built-in tools (pick 2-3 representative tools with mock sandbox)

## 7. LLM Adapter

- [ ] 7.1 Create abstract `LLMAdapter` interface definition in `src/adapters/interface.js` with `complete(messages)` and `stream(messages)` async methods, typed with zod
- [ ] 7.2 Create concrete OpenAI-compatible adapter in `src/adapters/openai.js` that sends requests to a configurable endpoint with `settings.llm.endpoint` and `settings.llm.model`
- [ ] 7.3 Implement adapter input builder in `src/adapters/builder.js`: injects SOUL.md as system message, includes context from memory injection, constructs tool-use messages
- [ ] 7.4 Write unit tests for adapter builder (`tests/unit/adapters/builder.test.js`)

## 8. Session Management (session-management)

- [ ] 8.1 Implement session state machine in `src/session/states.js`: define valid transitions (`idle → prompting → processing → idle / awaiting_approval / failed`), validate transitions
- [ ] 8.2 Implement session manager in `src/session/manager.js`: owns active session lifecycle, processes user input, dispatches to adapter and tools, manages state transitions
- [ ] 8.3 Implement context window tracker in `src/session/context.js`: counts lines/tokens, truncates oldest messages at `maxContextLines` limit, returns context state object
- [ ] 8.4 Implement session persistence in `src/session/persist.js`: writes `<session-id>.meta.json` on every state transition, reads on startup for resume; refuses to restore failed sessions
- [ ] 8.5 Implement session commands in `src/session/commands.js`: `/new` (save current, create new), `/status` (display session summary), `/history` (display past session list), `/resume` (load specific session), `/add-context` (append free-form text)
- [ ] 8.6 Write unit tests for state machine (`tests/unit/session/states.test.js`)
- [ ] 8.7 Write unit tests for context tracker (`tests/unit/session/context.test.js`)
- [ ] 8.8 Write unit tests for persistence (`tests/unit/session/persist.test.js`)

## 9. TUI Interface (tui-interface)

- [ ] 9.1 Create ink app entry point in `bin/madz.mjs`: parses CLI arguments (`--batch`, `--pipeline`, `--no-sandbox`, `--config`, `--init-config`, `--memory`), bootstraps config, sandbox, session

and TUI, launches correct mode
- [ ] 9.2 Create CLI argument parser in `src/config/cli.js`: defines all flags, handles mode switching, validates mutually exclusive flags
- [ ] 9.3 Build TUI root component in `src/tui/App.js`: renders header, mode indicator, conversation viewport, status bar, and input area using ink components
- [ ] 9.4 Build conversation viewport component in `src/tui/Viewport.js`: renders scrollable list of messages (user/assistant/tool), supports `j`/`k` key navigation and mouse wheel scrolling
- [ ] 9.5 Build input area component in `src/tui/Input.js`: supports multi-line input, handles typing events, dispatches on Enter, handles `/command` entry
- [ ] 9.6 Build keyboard hook in `src/tui/hooks/useKeys.js`: captures keypresses for shortcuts (`?` help, `Ctrl+L` clear, `m` mode switch, `j`/`k` scroll, Enter send, Tab autocomplete)
- [ ] 9.7 Build help overlay component in `src/tui/Help.js`: renders in a modal overlay showing all keyboard shortcuts with descriptions
- [ ] 9.8 Build approval prompt in `src/tui/Approval.js`: displays when destructive tool is invoked, shows tool details, awaits yes/no input
- [ ] 9.9 Build mode indicator in `src/tui/ModeIndicator.js`: shows persistent mode label that updates on mode switch
- [ ] 9.10 Build status bar in `src/tui/StatusBar.js`: shows session ID, context usage percentage, tool count, container health status — updates reactively
- [ ] 9.11 Implement non-interactive modes in `src/modes/`: `batch.js` (parse stdin, execute, output to stdout), `pipeline.js` (parse stdin, output structured JSON)
- [ ] 9.12 Write ink integration tests for TUI components (`tests/integration/tui/app.test.js`, `tests/integration/tui/viewport.test.js`) using ink's test renderer

## 10. Command Dispatch System

- [ ] 10.1 Create command router in `src/commands/router.js`: dispatches user input to either session message handler (if not `/`-prefixed) or command handlers (if `/`-prefixed)
- [ ] 10.2 Wire session commands from section 8.5 into the command router
- [ ] 10.3 Wire tool approval responses into the command router (yes → execute tool, no → abort tool)

## 11. Integration Tests & Polish

- [ ] 11.1 Write integration test: full conversational flow (user message → session processing → LLM call → tool dispatch → response display), mock external LLM and Docker
- [ ] 11.2 Write integration test: destructive tool approval flow (TUI prompts → user approves → tool executes)
- [ ] 11.3 Write integration test: config reload flow (change SOUL.md → /reload-config → new content is active without restart)
- [ ] 11.4 Write integration test: session save and restore (save session state → restart → session resumes from last state)
- [ ] 11.5 Write integration test: batch mode end-to-end (send stdin prompt → get stdout response, no TUI)
- [ ] 11.6 Write integration test: sandbox isolation (verify file operations respect mount boundaries via mock container)
- [ ] 11.7 Run `npx oxfmt` and `npx oxlint` across all source files — fix any lint/format issues
- [ ] 11.8 Run `node --test --coverage --coverage-exclude="**/tests/**" && node --test --coverage --coverage-reports=txt --coverage-exclude="**/tests/**"` and verify 100% coverage on all new files
- [ ] 11.9 Create default `SOUL.md` template in `src/config/default-soul.md`
- [ ] 11.10 Create sample `config.json` in project root with all defaults and comments (also generated by `--init-config`)

## 12. Final Verification

- [ ] 12.1 Verify all pre-commit hooks pass: `oxfmt` check, `oxlint` check, `node --test --coverage`
- [ ] 12.2 Verify that the application runs in all three modes: interactive (`node bin/madz.mjs`), batch (`node bin/madz.mjs --batch`), pipeline (`node bin/madz.mjs --pipeline`)
- [ ] 12.3 Verify `--no-sandbox` mode launches and logs the safety warning
- [ ] 12.4 Verify `--init-config` creates valid config file
- [ ] 12.5 Verify Docker container isolation: run with sandbox enabled, confirm container has read-only filesystem and dropped caps (`docker inspect`)
- [ ] 12.6 Verify 100% test coverage maintained across all 6 capability modules
- [ ] 12.7 Final pass: ensure all public functions have JSDoc, all error messages are non-Pll, all async operations have timeouts
