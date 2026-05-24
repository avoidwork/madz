## Why

No existing solution provides a terminal-native, fully auditable, and sandboxed harness for LLM-driven task automation. Developers and advanced users need a unified, keyboard-driven interface that chains tool invocations, manages session state, and maintains context across long-running operations — all within strict security boundaries and transparent persistence.

## What Changes

- A terminal user interface (TUI) application built in JavaScript (Node.js) with keyboard-driven interaction
- A modular tool registry with strictly scoped capabilities (file operations, shell execution, API requests, data transformation, web search)
- A file-based memory system using markdown documents for conversation history, tool outputs, and user-supplied context
- A SOUL.md personality and behavioral configuration system
- Docker-based sandboxed execution with filesystem isolation, network limits, and process boundaries
- Multiple interaction modes: interactive conversational, non-interactive batch, and pipeline-friendly output
- Session management with state persistence across operations
- Explicit permission gates for state-altering or destructive tool operations
- Structured JSON logging with PII stripping
- 100% test coverage enforced via pre-commit hooks (unit + integration)

## Capabilities

### New Capabilities

- `tui-interface`: Terminal user interface layer with keyboard shortcuts, viewport rendering, and multi-mode interaction (conversational, batch, pipeline)
- `tool-registry`: Modular, extensible tool system with input validation (zod schemas), allowlisted URLs, explicit approval gates, and standardized I/O contracts
- `file-based-memory`: Markdown-persisted conversation history, tool outputs, context injection, and cross-session recall with version control support
- `sandbox`: Docker container orchestration with filesystem mounts, network restrictions, process isolation, and leak prevention
- `session-management`: State machine for active sessions, context window management, and memory injection into LLM prompts
- `system-config`: Externalized configuration via plain-text files (SOUL.md, settings) with runtime-reloadable defaults and secure bootstrap

### Modified Capabilities

- N/A

## Impact

- **New dependencies**: Docker SDK for Node.js, terminal UI library (e.g., ink/tinymt), zod for validation, markdown file utilities
- **New directories**: `src/tui/`, `src/tools/`, `src/memory/`, `src/sandbox/`, `src/session/`, `src/config/`, `tests/unit/`, `tests/integration/`
- **New files**: `SOUL.md` (default personality), `Dockerfile`, `.dockerignore`, docker-compose configuration
- **Modified files**: `AGENTS.md` section 2.0 (project layout), `package.json` (new dependencies and scripts)
- **API surface**: Local-only TUI application (no HTTP server), but may expose a local API for tool orchestration internally
- **Security boundaries**: All tool execution gated by sandbox; file operations scoped to mounted volumes; network constrained to allowlisted domains
