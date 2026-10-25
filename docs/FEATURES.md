# Features

The built-in capabilities of the madz harness — providers, agents, tools, MCP, skills, memory, sandbox, telemetry, vector search, and cron scheduling.


### Onboarding

On first launch, `madz` starts an interactive onboarding flow that collects your profile — attractor (primary interest), expertise areas, dev tools, communication style preferences. This profile is stored as `memory/context/profile.md` and is loaded into the system prompt every session, making madz deeply personalized from the very first message. To re-trigger onboarding, delete `memory/context/profile.md` and restart.

### LLM Provider Abstraction

Configurable provider dispatch with rate limiting and context-window trimming. madz talks to its model through the OpenAI chat-completions API, so it works with **any OpenAI-compatible endpoint** — OpenAI, Ollama, vLLM, LiteLLM, LM Studio, llama.cpp, and others. Point `OPENAI_BASE_URL` at the server and `OPENAI_MODEL` at the model; local providers typically need no API key.

The active provider is selected by the `enabled` flag on each provider block in `config.yaml` (or the matching `*_ENABLED` env var), not by config position or `type`. **OpenAI is enabled by default.** To switch to GitHub Copilot, set `COPILOT_ENABLED=true` (and optionally `OPENAI_ENABLED=false`). Copilot authenticates via GitHub OAuth device flow — a bearer token is persisted to `memory/auth.json` and refreshed automatically, so no API key is required. For GitHub Enterprise Cloud (GHEC) deployments, set `COPILOT_ENTERPRISE_URL` to derive the API base.

### LLM Response Caching

A cache-aside LRU response cache sits between the agent and the LLM provider. On each call, the system checks the cache before invoking the API. A cache key is generated from the thread ID and a SHA-256 hash of the message content (`${threadId}_${hash}`). On a cache hit, the stored response is returned immediately without an API call. On a cache miss, the LLM is called and the response is stored for future lookups.

The cache enforces a maximum size (default: 100 entries) with LRU eviction and a time-to-live (default: 10 minutes). Cached entries expire after the TTL period and are evicted automatically. The cache is **fail-open** — cache retrieval or storage failures never block or prevent an LLM call.

**Conditional caching:** Responses are only cached when no tools or skills were invoked during agent execution. If the agent used any tools, the response is not cached. This prevents state-changing operations (file writes, shell commands, etc.) from being skipped on subsequent identical prompts.

**Streaming support:** For streaming calls, the cache is checked before the stream begins. If cached, the stored response is returned immediately. On successful stream completion, the aggregated final response is stored — individual streaming chunks are never cached. Failed or aborted streams do not cache partial responses.

**Configuration:** Cache parameters are fixed at build time — the LRU cache uses a hardcoded maximum size (500 entries) and is not configurable via `config.yaml`.

### Agent

Uses the [Deep Agents](https://github.com/langchain-ai/deepagentsjs) library to orchestrate a primary agent with a family of specialized subagents. The orchestrator routes tasks automatically — each subagent has a focused system prompt and a curated tool set matched to its domain.

**Built-in subagents:**

Tool access below is the madz tool set each agent receives via `TOOL_CLASSIFICATIONS` in `src/tools/index.js`. All subagents also carry the deepagents filesystem tools (`readFile`, `writeFile`, `patch`, `searchFiles`), which are not listed here.

| Agent | Purpose | Tool Access |
| ----- | ------- | ----------- |
| `code-review` | Structured code reviews covering bugs, security, style, performance | `clarify`, `skill`, `date`, `memory`, `todo`, `scanAgents`, `searchCode`, `getConfig` |
| `coding` | Code implementation with read-before-write discipline, complete shipping, convention adherence, and dead-code elimination | `clarify`, `skill`, `date`, `readImage`, `memory`, `todo`, `process`, `scanAgents`, `searchWeb`, `browser`, `docx`, `pptx`, `xlsx`, `pdf`, `email`, `spreadsheet`, `calendar`, `generatePdf`, `namecom`, `generatePptx`, `api`, `graphql`, `json`, `yaml`, `data`, `webhook`, `searchCode`, `indexCode`, `getConfig` |
| `debug` | Error tracing, reproduction, and fix proposals | `clarify`, `skill`, `date`, `readImage`, `memory`, `todo`, `process`, `docx`, `pptx`, `xlsx`, `pdf`, `email`, `spreadsheet`, `calendar`, `generatePdf`, `namecom`, `generatePptx`, `api`, `graphql`, `json`, `yaml`, `data`, `webhook`, `searchCode`, `indexCode`, `getConfig` |
| `documentation` | Documentation updates, API docs generation, changelog maintenance | `clarify`, `createSkill`, `skill`, `date`, `generateImage`, `readImage`, `memory`, `todo`, `sampling`, `textToSpeech`, `docx`, `pptx`, `xlsx`, `pdf`, `email`, `spreadsheet`, `calendar`, `generatePdf`, `namecom`, `generatePptx`, `api`, `graphql`, `json`, `yaml`, `data`, `webhook`, `searchCode`, `getConfig` |
| `performance` | Performance benchmarking, bottleneck identification, optimization suggestions | `clarify`, `cronJob`, `skill`, `date`, `memory`, `todo`, `process`, `calendar`, `searchCode`, `indexCode`, `getConfig` |
| `research` | Multi-step research with source tracking and comprehensive reports | `clarify`, `skill`, `date`, `readImage`, `memory`, `todo`, `searchSession`, `searchWeb`, `browser`, `docx`, `pptx`, `xlsx`, `pdf`, `email`, `spreadsheet`, `calendar`, `generatePdf`, `namecom`, `generatePptx`, `api`, `graphql`, `json`, `yaml`, `data`, `webhook`, `searchCode`, `getConfig` |
| `search` | Multi-source search (web, docs, codebase) with synthesis | `clarify`, `skill`, `date`, `readImage`, `memory`, `todo`, `searchSession`, `searchWeb`, `browser`, `docx`, `pptx`, `xlsx`, `pdf`, `email`, `spreadsheet`, `calendar`, `generatePdf`, `namecom`, `generatePptx`, `api`, `graphql`, `json`, `yaml`, `data`, `webhook`, `searchCode`, `getConfig` |
| `security-audit` | Security scanning, dependency auditing, vulnerability detection | `clarify`, `cronJob`, `skill`, `date`, `memory`, `todo`, `scanAgents`, `searchCode`, `getConfig` |
| `seoAnalyst` | SEO analysis — keyword density, meta description generation, SERP analysis, content optimization | `skill`, `searchCode` |
| `testing` | Test generation, gap analysis, and coverage improvements | `clarify`, `skill`, `date`, `memory`, `todo`, `searchCode`, `getConfig` |
| `textEditor` | Text processing — summarize, rewrite, tone adjustment, grammar correction, shorten, expand | `skill` |
| `translator` | Multi-language translation and language detection | `skill` |

**Default subagent temperatures:**

| Agent | Temperature | Rationale |
| ----- | ----------- | --------- |
| `code-review` | 0.1 | Maximum precision for review |
| `coding` | 0.3 | Balanced creativity and precision |
| `debug` | 0.2 | Precision work |
| `documentation` | 0.3 | Balanced output |
| `performance` | 0.2 | Structured analysis |
| `research` | 0.5 | Exploratory research |
| `search` | 0.5 | Exploratory search |
| `security-audit` | 0.1 | Maximum precision for security analysis |
| `seoAnalyst` | 0.3 | Analytical precision with room for insight |
| `testing` | 0.2 | Structured, deterministic output |
| `textEditor` | 0.4 | Balanced creativity and precision for language |
| `translator` | 0.3 | Nuanced translation with cultural fidelity |

Temperatures are configurable via `subAgentsTemperature` in `config.yaml` or environment variables (`SUB_AGENTS_TEMPERATURE_<AGENT_NAME>`).

Agent definitions are consolidated in `src/agent/agentDefinitions.js` (a data-driven config mapping each agent name to its prompt file and description), with the system prompts in `prompts/*.md`. Tool access is gated by `TOOL_CLASSIFICATIONS` in `src/tools/index.js` — each tool declares which agent types it serves, and the orchestrator filters tools per agent at runtime.

The orchestrator also manages two filesystem backends via the deepagents `CompositeBackend`: the core working directory and the memory context directory.

### Built-in Tools

All built-in tools are defined in `src/tools/` and registered as LangChain tools, gated by sandbox permissions.

| Tool | Description |
| ---- | ----------- |
| `api` | REST API client with auth (bearer, basic, apikey), URL filtering, timeouts, and rate limiting. |
| `calendar` | Read, create, and manage calendar events via Google Calendar API. |
| `clarify` | Send clarification questions to the user with optional numbered choices. Zero permissions — always registered. |
| `createSkill` | Create a spec-compliant skill directory with SKILL.md YAML frontmatter. Optionally scaffolds a `scripts/` directory. |
| `cronJob` | Manage scheduled cron jobs — create, list, update, pause, resume, run, remove. Persisted to `memory/schedules/`. Available to the orchestrator agent. |
| `browser` | Drive a real headless Chromium browser — click, type, fill, navigate, press keys, screenshot, extract DOM text, wait for selectors/network-idle, and evaluate JavaScript in page context. Validates every outbound URL against the sandbox allowlist. Pass a `sessionId` to chain actions across calls within a persistent browser session. |
| `data` | Format conversion between JSON, YAML, and CSV. |
| `date` | Return current date/time in ISO 8601 UTC or human-readable format. Zero permissions — always registered. |
| `decision` | Make fast, structured decisions using a local decision model via Ollama's `/v1/systemone` endpoint. Accepts a `state` (string or JSON object/array) and a `questions` record (each with a `type` of `choice`, `noul`, or `score`), returning structured answers. Config-gated — only registered when `agent.decision.baseUrl` is set. |
| `docx` | Read and extract content from `.docx` (Word) documents. |
| `email` | Read, send, manage drafts, organize, and search emails. Actions: `read`, `send`, `draftSave`, `draftList`, `draftUpdate`, `draftDelete`, `organize`, `search`. Requires email provider credentials via environment variables. |
| `generateImage` | Generate images via FAL.ai flux/klein API. |
| `generatePdf` | Generate PDFs from HTML or markdown, or manipulate existing PDFs (merge, split, watermark, signature, annotate). Use action to specify the operation. |
| `generatePptx` | Generate PowerPoint presentations from a structured description. |
| `getConfig` | Get the full harness configuration as a parsed JSON object. |
| `graphql` | GraphQL client with depth/complexity limits, introspection support, and rate limiting. |
| `indexCode` | Index project source code for vector search. Scans configured project directories, chunks source files, generates embeddings, and stores them for semantic search. Runs incrementally — only processes changed files. |
| `json` | JSON parse, serialize, transform, filter, and access operations. |
| `memory` | Persistent key-value memory with CRUD actions (create, read, update, delete, list). Each entry stored as `.md` in `memory/context/` with `createdDate`/`updatedDate` metadata. |
| `namecom` | DNS name resolution and lookup. |
| `pdf` | Read and extract content from PDF documents. |
| `pptx` | Read and extract content from `.pptx` (PowerPoint) documents. |
| `process` | Execute shell commands and manage background processes. Actions: start (launch command), list (show all), log (read stdout/stderr), wait (wait for exit), kill (SIGTERM/SIGKILL), write (send stdin data), pause (SIGSTOP), resume (SIGCONT). |
| `readImage` | Read an image file from disk and return its base64-encoded contents plus MIME type, for direct LLM vision analysis. |
| `reflectionSessions` | Read session files, filter by date window and ignore patterns, extract user messages, and return structured data. |
| `sampling` | Capture emotional moments as ephemeral memories. Rate-limited to 1 per 60 minutes. Stored with `expiresAt` frontmatter. |
| `scanAgents` | Scan for `AGENTS.md` workspace rules files in a target directory. Returns file contents or empty string. |
| `searchCode` | Semantic code search using vector similarity. Finds conceptually related code even when exact keywords don't match — e.g., searching for "authentication" finds login handlers, token validation, and auth middleware. |
| `searchSession` | Search past conversations by keyword query, full retrieval by conversation ID, or browse all sessions. |
| `searchWeb` | Search the web via DuckDuckGo, Google, Bing, SearXNG, Custom, or Tavily endpoints. |
| `skill` | Load a specialized skill when the task matches one listed in the system prompt. Returns the full SKILL.md body plus a sampled inventory of the skill's supporting files (scripts/, references/, assets/). |
| `spreadsheet` | Spreadsheet computation and analysis. Actions: compute (sum, average, count, min, max, formula, median, stddev, variance), generate (create XLSX with formulas), analyze (pivot tables, filtering, groupBy, stats, percentile), csvImport, csvExport, modify (add/modify/delete cells and sheets), export (XLSX, CSV, JSON). |
| `textToSpeech` | Convert text to speech via OpenAI TTS (tts-1/tts-1-hd). Saves MP3 to `~/voice-memos/`. |
| `todo` | Task management with key-based CRUD. Actions: read (get all todos), create (add by key), update (modify by key), complete (mark done by key), delete (remove by key), list (all or filter by pending/completed), clear (remove all). Persists to `memory/tools/todo.json`. |
| `webhook` | Webhook CRUD and HMAC verification with URL validation. |
| `xlsx` | Read and extract content from `.xlsx` (Excel) spreadsheets. |
| `yaml` | YAML parse, serialize, transform, filter, and access operations. |

**Deep Agents tools:** Core filesystem operations (`readFile`, `writeFile`, `patch`, `searchFiles`) are provided by [deepagentsjs](https://github.com/langchain-ai/deepagentsjs) and are not listed as madz-built-in tools. Task management is provided by the madz `todo` tool above.

**MCP tools:** Tools exposed by [Model Context Protocol](https://modelcontextprotocol.io) servers are discovered at runtime from the `mcp` config section and registered alongside the built-in tools. They are dynamic — not part of the static table above. See [MCP Servers](#mcp-servers).

### MCP Servers

madz supports [Model Context Protocol](https://modelcontextprotocol.io) (MCP) servers, letting you plug in external tools and data sources declaratively via `config.yaml`. At startup, madz connects to each configured server, discovers its tools, and registers them alongside the built-in tools.

#### Configuration

Add a root-level `mcp` key. Each server is a named entry under it, specifying a transport and its connection parameters:

```yaml
mcp:
  docs:
    transport: http
    url: https://docs.langchain.com/mcp
  local-fs:
    transport: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
    env:
      API_KEY: "${MCP_API_KEY}"
  legacy:
    transport: sse
    url: https://example.com/mcp
```

#### Transports

| Transport | Fields | Description |
| --------- | ------ | ----------- |
| `stdio` | `command`, `args`, `env?` | Local, process-spawned server (e.g., `npx`-launched). |
| `http` | `url` | Streamable HTTP — the default for remote servers. |
| `sse` | `url` | HTTP + SSE, for backwards compatibility with older servers. |

#### Classifying tools

Each server can carry an optional `agents` list that determines which agent types receive its tools. When absent, tools default to the orchestrator only.

```yaml
mcp:
  local-fs:
    transport: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
    agents: ["coding", "search"]   # tools go to these subagents
```

- **No `agents`** → tools are added to the orchestrator.
- **`agents: ["coding", "search"]`** → tools are delegated to those subagents only.
- **`agents: ["orchestrator", "coding"]`** → tools are available to both the orchestrator and the `coding` subagent.

The MCP server only exposes the tool (name, schema, handler). The `agents` classification is a madz-specific extension — it lives in your config, not on the server.

#### Behavior

- MCP tools are **dynamic** — discovered at runtime, so they are appended to the tool list rather than added to the static `TOOLS` map.
- A server that fails to connect logs a warning and is **skipped** — startup never crashes on a bad server.
- The adapter stays open for the agent's lifetime and is closed on shutdown.
- Tool names are prefixed with the server name (e.g., `local-fs_read_file`) to avoid collisions.

### Decisioning Models

The `decision` tool wraps Ollama's `/v1/systemone` endpoint (which follows TypeSafe's Jev API) for fast, structured classification — routing a support ticket, checking a request against a policy, or scoring against a rubric. It uses a local decision model such as **tev1** from Together AI, fine-tuned from Qwen3.5 in 4B and 0.8B sizes. You give it a `state` (the text to judge) and a set of `questions`, and it selects an answer based on likely outcome, returning the probability of each option.

Unlike a chat model, a decision model is not an agentic loop — it does not tool-call or iterate. It returns structured answers from a single request, which is why it's exposed as a tool rather than a subagent.

**Configuration** lives under `agent.decision`. `baseUrl` is the activation switch — an empty string means the tool is not registered, so an unconfigured install is unaffected:

```yaml
agent:
  decision:
    baseUrl: ""            # empty = tool not registered
    model: tev1:4b
```

Set `baseUrl` to your local Ollama instance (e.g. `http://localhost:11434`) to enable it. Requires **Ollama 0.35+**, and the model is pulled via `ollama pull tev1:4b` (4.5GB, 256K context) or `ollama pull tev1:0.8b` (812MB).

**Question types:**

| Type | `criteria` | Answer fields |
| ---- | ---------- | ------------- |
| `choice` | An object mapping each option to a description (use `null` to let the option name describe itself) | `choice`, `probabilities`, `confidence` |
| `noul` | Optional `{ "true": "...", "false": "..." }` to describe each side | `noul`, the probability that the answer is true |
| `score` | An array of level descriptions, lowest first (levels numbered from 0) | `score` (probability-weighted level), `legend`, `probabilities`, `confidence` |

**Notes:**

- Use `/v1/systemone`, not the regular chat endpoint — in a regular chat, tev1 tends to reply in prose.
- Keep inputs short: every question is scored with the full state and question set in its prompt, and tev1 runs at ~2,000 tokens context. The longest training example is ~1,500 tokens.
- `choice` and `score` questions take 2–26 options (tev1 was trained on 2–24). Add a `none` option if none of your options might fit.
- Request bodies are limited to 64 KiB.
- It can be wrong — don't let it be the only check on a high-stakes decision.

### File Path Autocomplete

While typing in the input bar, type `@` followed by a path fragment to open a live file picker. It globs the active project directory (excluding `node_modules`, `.git`, and `dist`), filters by a case-insensitive substring match, and lists matching files sorted by path length (shortest first), then by locale collation. A rotating window shows up to 3 options at a time with the `▸` indicator.

The picker owns all input while open: printable characters refine the filter, backspace deletes, left/right move the cursor, up/down navigate the list, Enter inserts the selected path, and Escape closes without selecting. The filter is always a substring match — never interpolated into a glob pattern — so glob metacharacters are treated literally.

### Active Project

The active project is the directory the file picker globs and the agent treats as its working root. It defaults to the launch directory (`config.cwd`). Use `/projects` to open the projects panel, which lists directories under `./projects/` — select one to set it as the active project, or select `(clear active project)` to reset it to the default. You can also run `/projects clear` directly. The active project is shown in the status bar and can be toggled via the `statusBar.project` config option.

### Skills Registry

Auto-discovers Agent Skills spec-compliant skills from a `skills/` directory structure. Each skill directory contains a `SKILL.md` file with YAML frontmatter (`name` required, 1-64 lowercase alphanumeric + hyphens; `description` required, 1-1024 characters; optional `license`, `compatibility`, `metadata`). Supports optional `scripts/` subdirectory containing executable scripts (detected by extension: `.py`, `.sh`, `.js`, `.rb`, `.ts`). The `createSkill` tool lets agents create new skills programmatically — validating spec constraints before writing `SKILL.md` and optionally scaffolding a `scripts/` directory.

System skills in `.skills/` are scanned first and shadow user skills of the same name in `skills/`.

### Permission Gating

Built-in tools are registered only when their required permissions are enabled for the session. Tools like `date` have zero permissions and always register.

| Permission Required                 | Tools                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------- |
| _(none)_                            | `date`, `textToSpeech`                                                    |
| `filesystem:read`                   | `readImage`, `scanAgents`, `searchSession`, `docx`, `pptx`, `xlsx`, `pdf`, `reflectionSessions`, `json`, `yaml`, `data`, `searchCode`, `getConfig`, `skill` |
| `filesystem:write`                  | `createSkill`, `sampling`, `generatePptx`                                  |
| `filesystem:read` + `filesystem:write` | `clarify`, `memory`, `todo`, `spreadsheet`, `webhook`, `indexCode`      |
| `filesystem:exec` + `process:spawn` | `process`                                                                  |
| `network:outbound`                  | `cronJob`, `generateImage`, `searchWeb`, `browser`, `email`, `calendar`, `namecom`, `api`, `graphql`, `decision` |
| `filesystem:read` + `filesystem:write` + `network:outbound` | `generatePdf` |

### Memory System

`madz` operates on a triple-layer memory architecture that evolves naturally over time:

**Canonical Memories**
Set explicitly by the user, these form the enduring foundation of the system. Stored as individual Markdown files in `memory/context/`, each carries `createdDate` and `updatedDate` metadata in YAML frontmatter. At the start of every session, canonical memories are loaded and appended to the system prompt, ensuring core context, preferences, and personal details remain consistent across interactions. Includes profile, clarifications, and temporal captures.

**Ephemeral Memories**
Captured autonomously by the harness during operation, these record patterns, milestones, emotional tones, and recurring themes. Stored temporarily with automatic expiration via `expiresAt` frontmatter, they act as a living lens — subtly influencing how `madz` approaches future tasks, adapts its tone, and anticipates needs. They are not hardcoded; they evolve organically as the relationship deepens. Cleaned automatically by `expireEphemeralMemories()`.

**Reflections**
A daily cron job (`0 2 * * *`) installed automatically on first onboarding completion. Runs `/reflection` via `--chat` mode, generating a narrative reflection summary from recent session history. The job definition is persisted as `memory/schedules/reflection-daily.json` and registered in the system crontab under the `madz-schedules` block. Reflections are stored as canonical memories in `memory/context/` with `createdDate` and `updatedDate` metadata.

Together, these layers create a system that remembers what matters while naturally adapting to how you work. When you update or delete a canonical memory, follow it with `/new` so the current session reflects the change immediately.

**Memory tool actions:** `create` (new memory), `read` (get by key), `update` (modify by key), `delete` (remove by key), `list` (all memories, optional query filter)

### Sandbox RTE

Filesystem and network access for built-in tools is constrained by `src/sandbox/`: `pathResolver.js` enforces an allowlist/denylist of paths (negative `!exclude/` rules win, traversal outside allowed roots is blocked), and `urlFilter.js` blocks `file://`, `gopher://`, and `dict://` plus internal IP ranges, with an optional hostname allowlist.

Skills themselves are `SKILL.md` instruction files interpreted by the agent — they are not spawned into a separate process. There is no per-skill time limit, memory cap, or env-var filter; the container boundary is the isolation boundary. See [THREAT_MODEL.md](docs/THREAT_MODEL.md) for the honest boundary description.

### Telemetry

Optional `@opentelemetry/sdk-node` integration. Configurable exporter (console, OTLP HTTP, OTLP gRPC) and probability sampling.

### Vector Search

Semantic code search using local vector embeddings and SQLite-based KNN retrieval. Enables finding code by meaning rather than exact keyword matches — useful for debugging, refactoring, and feature implementation.

**Architecture:** Source files are chunked into fixed-size line blocks with configurable overlap, embedded into 384-dimensional vectors via transformers.js (local) or OpenAI, and stored in a sqlite-vec virtual table for cosine-distance KNN search.

**Modules:**
- `src/vector/chunker.js` — Splits source files into line blocks (default: 96 lines, 16-line overlap)
- `src/vector/embedder.js` — Generates embeddings via `Xenova/all-MiniLM-L6-v2` (local, default) or OpenAI `text-embedding-3-small`
- `src/vector/store.js` — SQLite-backed vector store using `better-sqlite3` + `@photostructure/sqlite-vec`
- `src/vector/indexer.js` — Orchestrates scanning, chunking, embedding, and storage with incremental mtime-based caching

**Tools:**
- `searchCode` — Query indexed code semantically. Available to orchestrator and all code-related subagents.
- `indexCode` — Trigger indexing from conversation. Runs incrementally; pass `force: true` to re-index all files.

**Configuration** in `config.yaml` under `vector.projects.<name>` — each project defines its own `rootDir`, `dbPath`, chunking parameters, and include/exclude patterns. See `docs/VECTOR_SEARCH.md` for full documentation.

### Cron Scheduler

Recurring job definitions in `config.yaml`. Scheduling is delegated to the system crontab — there is no in-process clock tick loop. Each invocation inherits the current session's memory context and sandbox permissions.

On first onboarding completion, `madz` automatically installs a `reflection-daily` cron job (`0 2 * * *`) into the system crontab. Job definitions are persisted as JSON in `memory/schedules/` and managed under the `madz-schedules` block.

