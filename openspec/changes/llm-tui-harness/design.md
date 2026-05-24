## Context

The project is a Node.js 20+ application using ES modules. Currently no codebase exists for this capability — this is a greenfield project that must conform to the existing `AGENTS.md` conventions (strict lint/coverage, pre-commit hooks, error hierarchy, JSDoc on all public APIs). The application is a terminal-native harness, not an HTTP server, so it runs as a CLI process with an interactive TUI.

Constraints: Node.js 20+, npm package manager, `oxfmt` (line-length 100) and `oxlint` enforced, 100% coverage required, structured JSON logging, parameterized/validated input (zod), Docker sandbox for tool execution.

## Goals / Non-Goals

**Goals:**
- Deliver a keyboard-driven TUI for conversational and batch LLM interaction
- Provide a modular, validated, sandboxed tool execution system
- Persist all conversation history and context as human-readable markdown
- Enforce security boundaries: Docker isolation, URL allowlisting, permission gates
- Maintain 100% test coverage across unit and integration tests
- Support extension via custom tool definitions

**Non-Goals:**
- HTTP API or web interface (TUI only)
- Multi-user or authentication (single-user dev tool; `auth: none` mode)
- Real-time streaming or multi-instance collaboration
- Cloud-based memory or remote persistence
- LLM provider integration beyond a pluggable adapter layer — first release supports one provider (configurable endpoint)

## Decisions

### D1: Terminal UI Library — `ink` (React-based) over `blessed` or `ink-textbox`
- **Choice**: Use `ink` (React primitives for terminal) with a custom layout system.
- **Rationale**: React component model integrates well with Node.js ES modules; large ecosystem; declarative rendering avoids imperative state bugs. `blessed` is older with a steeper learning curve and smaller ecosystem. `ink` also composes with React testing library for UI tests.
- **Alternative considered**: `blessed-contrib` — dismissed due to age and limited maintainership.

### D2: Tool Execution — In-process with Docker sandbox fallback
- **Choice**: Standard tools (file read/write, shell, API, transform) execute in-process within the same Node.js runtime but are sandboxed via Docker container boundaries. The Docker container is where the LLM runs; tool execution is proxied from the TUI process into the container.
- **Rationale**: This matches the "sandboxed harness" architectural pattern — the LLM runs inside Docker, the TUI runs on the host. Tools execute as commands inside the container with strict filesystem and network scoping using Docker's `--read-only`, `--network`, `--cap-drop=ALL`.
- **Alternative considered**: Run the entire TUI inside Docker — dismissed due to terminal rendering complexity and performance overhead.

### D3: Memory System — Append-only markdown files per session
- **Choice**: Each session produces one or more `.md` files in a configured memory directory. Conversation turns are appended; tool outputs are embedded as markdown code blocks. Memory files support version control (git) natively.
- **Rationale**: Plain text is human-readable, diffable, and version-controllable. Markdown provides structure without requiring a database. Cross-session recall is achieved by scanning the memory directory for session IDs or date ranges.
- **Alternative considered**: SQLite — dismissed as unnecessary complexity when plain text meets all requirements and supports git-based auditing.

### D4: Configuration — JSON settings file + SOUL.md personality file
- **Choice**: `config.json` (or `.jsonc`) for application settings (Docker paths, tool allowlists, memory directory, LLM endpoint). `SOUL.md` for personality, tone, expertise domains, and behavioral constraints. Both are plain text, user-editable, and optionally reloadable at runtime.
- **Rationale**: Plain-text configuration is portable, shareable, and version-controllable. SOUL.md as markdown allows rich personality definitions (headers, lists, examples).
- **Alternative considered**: `.env` files — dismissed as too opaque for structured config (tool allowlists, nested settings).

### D5: LLM Adapter — Pluggable interface with single concrete implementation
- **Choice**: Define an abstract `LLMAdapter` interface (async methods: `complete`, `stream`, with typed input/output). Ship one concrete adapter (e.g., OpenAI-compatible HTTP API). Users can implement additional adapters.
- **Rationale**: Keeps the harness provider-agnostic. All LLM calls go through adapters, making it easy to swap providers or add new ones without TUI changes.
- **Alternative considered**: Hardcode a single provider — dismissed as too restrictive for a developer tool.

### D6: Permission Gates — Interactive confirmation before destructive tools
- **Choice**: Destructive operations (file write/delete, shell commands with side effects) pause the TUI with a confirmation prompt. Non-destructive tools (file read, search) execute without prompts. The user can set a global "auto-approve" flag in settings (with security warning).
- **Rationale**: Balances usability (bulk operations shouldn't halt for every file read) with safety (destructions require human approval).
- **Alternative considered**: Require confirmation for all tools — dismissed as too friction-heavy.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Docker latency adds delay to tool execution (~1-3s container start) | Pre-warm container; use `docker run --rm` with minimal image; cache layer for repeated operations |
| Terminal rendering jank with rapid LLM streaming output | Render incrementally with debounced buffer flushes; use `ink`'s `renderOnce` for stable portions |
| SOUL.md adversarial prompting could cause model drift | SOUL.md is injected as system prompt, not user prompt; input validation on memory files via zod sanitization |
| Memory files grow unbounded over long sessions | Configurable memory truncation policy (max lines, time window, or token budget). Archive old sessions to `.md.gz` |
| Single-provider adapter limits out-of-box utility | Abstract adapter interface; first release ships with one but document the extension contract; accept community adapters later |
| Docker requires root or `docker` group membership | Document group setup; provide `--no-sandbox` mode for development (warns user of reduced isolation) |
| 100% test coverage with TUI is difficult | Test all non-UI logic (tools, memory, session, config) with 100% coverage. UI tests use `ink`'s test renderer to verify component tree output without a real terminal |
