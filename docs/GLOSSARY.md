# Glossary

Shared vocabulary used across the madz documentation. Terms are defined in the context of how madz uses them — not their general meaning.

## Core Architecture

### Orchestrator
The top-level agent that coordinates the whole session. Built by `createDeepAgentsOrchestrator()` in `src/agent/deepAgents.js`. It holds the system prompt, the orchestrator tools, the backends, the subagent definitions, and the middleware stack. It decides when to delegate work to a subagent via the `task` tool.

### Subagent
A specialized agent that the orchestrator delegates to. There are 12 defined in `src/agent/agentDefinitions.js` (coding, search, debug, code-review, research, testing, documentation, security-audit, performance, textEditor, seoAnalyst, translator). Each carries its own tool set and system prompt.

### Deep Agents
The library (`deepagents`) that compiles the agent loop. It supplies the middleware stack (filesystem, subagents, skills, summarization, patch-tool-calls). madz adds its own middleware on top.

### Backend
An abstraction over file I/O. madz uses two from the `deepagents` library:
- **`LocalShellBackend`** — execution-capable; resolves paths against `process.cwd()`. Used as the default (core) backend.
- **`FilesystemBackend`** — read/write only; resolves paths against a fixed `rootDir`. Used for the memory context directory.

### CompositeBackend
A router that combines multiple backends. It routes file operations to different backends based on path prefix (longest match first). madz routes `/memory/context/` to the context backend and everything else to the core backend.

### Checkpointer
Persists LangGraph state between turns. madz uses `SqliteSaver` (default, SQLite-backed) or `MemorySaver` (in-memory, for testing).

### Middleware
Functions that wrap the model call. madz adds `createCodeInterpreterMiddleware()` (from `@langchain/quickjs`) and, when `rateLimit.maxTokensMinute > 0`, `createTokenBudgetMiddleware()`. Composition order is **first = outermost, last = innermost**.

## Tools

### ORCHESTRATOR_TOOLS
The allowlist of tools the orchestrator receives. Defined in `src/tools/index.js`. General-purpose tools for communication, context management, and lookup. Domain-specific tools are delegated to subagents.

### TOOL_CLASSIFICATIONS
A map of tool name → array of agent names. A subagent receives a tool when its own name appears in that tool's classification array. There is no `shared` tier.

### Tool Factory
A function that builds a tool instance with runtime options (e.g., `createEmailProvider(config)`). Used where a tool needs configuration that isn't available at module load time.

## Config

### config.yaml
The single source of project configuration, loaded by `src/config/loader.js`. Sensitive values are injected via environment variables.

### DROPPED_KEYS
Container keys stripped from the env-var name when mapping config paths to environment variables. These are `providers`, `credentials`, `ratelimit`, `timeout`, `search`, `process`, `calendar`, and `subAgentsTemperature`. For example, `providers.openai.credentials.apiKey` → `OPENAI_API_KEY`.

### syncEnv
Materializes config structure from environment variables. It scans `process.env` for keys matching known config section prefixes and builds any missing structure (objects, arrays) into the raw config. Idempotent — never overrides existing YAML keys.

## Memory

### Canonical Memory
Long-term, user-defined context stored as individual `.md` files in `memory/context/`. Loaded at session start and appended to the system prompt. Includes profile, clarifications, reflections, and temporal captures.

### Ephemeral Memory
Autonomously captured moments (victories, frustrations, insights) with automatic expiration via an `expiresAt` frontmatter field. Cleaned by `expireEphemeralMemories()` at startup.

### Reflection
A daily-generated memory produced by a cron job (`0 2 * * *`) that runs the reflection skill. Stored as canonical memories with `createdDate` and `updatedDate` metadata.

## Sandbox

### Sandbox
The constraint layer that limits what tools can do. It is **not** an OS-level security boundary — it validates paths and URLs at the tool layer. The former process-sandbox runtime (`runner.js`, `envInjector.js`, `capability.js`, `timeoutHandler.js`) was removed as dead code.

### resolvePath / assertPathAllowed
Path validation in `src/sandbox/pathResolver.js`. `resolvePath` returns `{ allowed, path }`; `assertPathAllowed` wraps it and throws. Used by `src/tools/common.js` for tool-side filesystem scope enforcement.

### filterUrl
URL validation in `src/sandbox/urlFilter.js`. Blocks `file://`, `gopher://`, `dict://` schemes and internal IP ranges. Used for outbound tool requests.

## Vector Search

### vector.projects
Named project configurations under the `vector` section of `config.yaml`. Each defines its own `rootDir`, `dbPath`, and indexing rules. Configurable via `VECTOR_PROJECTS_*` env vars.

### searchMode
The default search mode for `searchCode`: `vector` (semantic similarity), `fulltext` (keyword FTS5), or `hybrid` (both, merged via Reciprocal Rank Fusion). Default is `hybrid`.

### RRF (Reciprocal Rank Fusion)
The algorithm that merges vector and full-text search results. Each result's rank is inverted and summed; the highest combined score wins.

## TUI

### Panel
A full-screen view in the TUI. The conversation view is the default; `skills`, `memory`, `settings`, `sessions`, and `projects` are separate panels toggled via commands or Tab.

### File Picker
The `@`-triggered file autocomplete in the input area. Typing `@` opens a fast-glob file list scoped to the active project (or the container root). Owns all keystrokes while open.

### Active Project
The currently-selected project directory, set via `/projects`. When set, the file picker and the agent's file operations resolve relative to it instead of the container root.

### Streaming Segment
A unit of streamed output. The TUI coalesces incoming `message` and `reasoning` events into ordered segments per message bubble. Coalescing is driven by segment type and grammatical sentence boundaries — not timing.
