# Architecture Overview

This document describes how madz is structured, how subsystems interact, and the key data flows through them. It covers the runtime components — not how to configure or contribute code (see [README.md](../README.md) and [CODE_STYLE.md](./CODE_STYLE.md)).

---

## System Diagram

```mermaid
graph TD
    C["config.yaml"] -->|"loadConfig()"| I["index.js"]
    I --> T["Telemetry"]
    I --> R["Registry"]
    I --> S["Scheduler"]
    R --> A["Agent"]
    A -->|"cache-aside"| L["Cache"]
    L --> P["Provider"]
    A -->|"tools"| SB["Sandbox"]
    S -->|"runNow()"| SB
    SB -->|"spawn()"| SK["scripts/"]
    TM["Memory Files"] -->|"loadContext"| A
    TM -->|write/read| FS["filesystem"]
    TM -->|context| SE["Session"]
    SE -->|context window| CW["conversation state"]
    UI["TUI (Ink)"] -->|"dispatchProvider"| A
    UI -->|"invokeSkill"| SB
    I <-->|handleConversation / invokeSkill| UI
    classDef root fill:#f9a825,color:#fff,stroke:#e65100
    classDef core fill:#42a5f5,color:#fff,stroke:#1565c0
    classDef util fill:#66bb6a,color:#fff,stroke:#2e7d32
    classDef ext fill:#ab47bc,color:#fff,stroke:#6a1b9a
    classDef cache fill:#26a69a,color:#fff,stroke:#00695c
    class I root
    class A,P,T,R core
    class L cache
    class S,TM,SE,SB util
    class SK,CW,FS ext
```

---

## Entry Point

`index.js` bootstraps all subsystems and wires them together.

**Startup:**

1. `loadConfig()` → reads `config.yaml`, deep-merges defaults, resolves env vars, validates via Zod
2. Conditionally boots Telemetry (`config.telemetry.enabled`)
3. Creates `SkillRegistry`, calls `discover("skills/")`
4. Loads memory system, creates session + `SessionStateManager`
5. Creates `ScheduleManager`, defines `dispatchProvider()`, `handleConversation()`, `invokeSkill()`

**Shutdown:** saves session → cleans retained memory → flushes OpenTelemetry.

**TUI exports:** `config`, `sessionId`, `sessionState`, `registry`, `dispatchProvider`, `handleConversation`, `invokeSkill`, `handleShutdown`, `scheduleManager`, `setConfigValue`, `loadContext`, memory helpers.

---

## Config

`src/config/` — YAML config with Zod validation, recursive env var resolution, runtime mutation.

| File | Purpose |
|------|---------|
| `schemas.js` | Zod schemas: `ConfigSchema`, `ProvidersSchema`, `SandboxScopeSchema`, etc. |
| `loader.js` | Loads `config.yaml`, merges defaults, resolves env vars, validates |
| `mutate.js` | `parseValue()`, `assignPath()`, `applyDotPathMutation()` — dot-path mutation with Zod validation |

Env var resolution maps config paths → `UPPER_SNAKE_CASE` (e.g., `sandbox.timeout.seconds` → `SANDBOX_TIMEOUT_SECONDS`). `'providers'`/`'credentials'`/`'process'` containers are dropped from the name path. String env values auto-parsed to booleans/numbers. Legacy `${VAR_NAME}` interpolation supported as fallback.

---

## Subsystems

### Provider

`src/provider/` — LLM provider factory from configuration.

| File | Purpose |
|------|---------|
| `openai.js` | `createChatModel()` — produces `ChatOpenAI` from `ProviderConfig` |

The provider config includes an optional `encoding` field (mapped from `OPENAI_ENCODING` env var) that specifies the tiktoken encoder name for token counting. This is primarily useful when using non-OpenAI models via `OPENAI_BASE_URL`.

The provider instance is consumed by `Agent` (via `createReactAgent`) or `dispatchProvider()` in `index.js`.

---

### Cache

`src/cache/` — cache-aside LRU response cache for LLM API calls.

| File | Purpose |
|------|---------|
| `llm_cache.js` | `createLlmCache(size, ttl)` — creates a tiny-lru-backed cache with `get()`, `set()`, `clear()` methods; `getCacheKey(threadId, message)` — generates `${threadId}_${sha256_hash}` cache keys |

**How it works:**

```mermaid
flowchart TD
    A[LLM Call Request] --> B{Cache Hit?}
    B -->|Yes| C[Return Cached Response]
    B -->|No| D[Call LLM]
    D --> E[LLM Response]
    E --> F{Tools Invoked?}
    F -->|No| G[Store in Cache]
    F -->|Yes| H[Skip Caching]
    G --> I[Return Response]
    H --> I
    C --> I

    subgraph Eviction
        J[Max Size Reached?] -->|Yes| K[LRU Evict Oldest]
        L[TTL Expired?] -->|Yes| M[Remove Entry]
    end

    G --> Eviction

    style A fill:#37474f,color:#fff
    style C fill:#37474f,color:#fff
    style I fill:#37474f,color:#fff
    style K fill:#37474f,color:#fff
    style M fill:#37474f,color:#fff
```

1. **Cache-aside pattern:** Before every LLM call (both streaming and non-streaming), the system checks the cache using a key derived from the thread ID and SHA-256 hash of the message content. On a hit, the cached response is returned immediately without an API call. On a miss, the LLM is called and the response is stored.
2. **Conditional caching:** Responses are only cached when no tools or skills were invoked during agent execution. This prevents state-changing operations from being skipped on subsequent identical prompts.
3. **Streaming support:** For streaming calls, the cache is checked before the stream begins. On successful completion, the aggregated final response is stored — individual chunks are never cached. Failed or aborted streams do not cache partial responses.
4. **Eviction:** The cache enforces a maximum size (default: 100 entries) with LRU eviction. Entries expire after the configured TTL (default: 600000ms / 10 minutes).
5. **Fail-open:** Cache retrieval or storage failures never block or prevent an LLM call.

---

### Agent

`src/agent/` — ReAct agent wrapper around LangGraph's prebuilt builder.

| File | Purpose |
|------|---------|
| `react.js` | `createReactAgent()` — compiles `createReactAgentGraph`; `callReactAgent()` — runs loop, returns response |

The agent runs: reason → call tool(s) → reason again → answer. Tool array built by `buildToolConfig()` gates definitions on sandbox permissions.

#### Prompt Rewrite Pipeline

`src/agent/promptPipeline/` — A two-stage LLM pre-processing pipeline that classifies and rewrites user prompts before they reach the agent graph. Disabled by default (`config.agent.promptRewrite.enabled: false`).

```mermaid
flowchart TD
    A[User Input] --> B{Pipeline Enabled?}
    B -->|No| C[Pass through unchanged]
    B -->|Yes| D[classifyPrompt]
    D --> E[LLM: classify intent/domain/complexity]
    E --> F{Valid JSON + Valid Categories?}
    F -->|Yes| G[Classification Metadata]
    F -->|No| H[DEFAULT_METADATA\nintent=other, domain=general, complexity=moderate]
    G --> I[rewritePrompt]
    H --> I
    I --> J[Load intent-specific template from ./prompts/]
    J --> K[Replace userPrompt, intent, domain, complexity]
    K --> L[LLM: rewrite prompt]
    L --> M{Success?}
    M -->|Yes| N[Rewritten Prompt]
    M -->|No| O[Original User Input]
    C --> P[HumanMessage]
    N --> P
    O --> P
    P --> Q[Agent Graph]

    style A fill:#37474f,color:#fff
    style C fill:#37474f,color:#fff
    style I fill:#37474f,color:#fff
    style K fill:#37474f,color:#fff
    style M fill:#37474f,color:#fff
```

**Pipeline stages:**

| Stage | Function | Input | Output |
|-------|----------|-------|--------|
| **Classify** | `classifyPrompt(model, userPrompt)` | Raw prompt string | `{ intent, domain, complexity }` metadata |
| **Rewrite** | `rewritePrompt(model, userPrompt, metadata)` | Raw prompt + metadata | Optimized prompt string |
| **Orchestrate** | `processPrompt(model, userPrompt)` | Raw prompt string | `{ rewrittenPrompt, metadata }` |

**External templates:** Intent-specific rewrite templates are loaded from `./prompts/REWRITE_{INTENT}.md`:

| Intent | Template File |
|--------|---------------|
| `question` | `./prompts/REWRITE_QUESTION.md` |
| `task` | `./prompts/REWRITE_TASK.md` |
| `creative` | `./prompts/REWRITE_CREATIVE.md` |
| `analysis` | `./prompts/REWRITE_ANALYSIS.md` |
| `other` (default) | `./prompts/REWRITE_OTHER.md` |

Templates use `{{placeholder}}` syntax for `userPrompt`, `intent`, `domain`, and `complexity`. Unknown intents fall back to `REWRITE_OTHER.md`. If external files are missing, an inline default template is used.

**Error handling:** The pipeline is fail-safe — classification failures return default metadata, rewriting failures return the original message, and any unhandled errors fall back to the original message. The agent graph always receives a `HumanMessage` with the same structure.

---

### Memory

`src/memory/` — persistent Markdown storage with YAML frontmatter, triple-layer architecture (canonical + ephemeral + reflection), and automated daily reflection scheduling.

| File | Purpose |
|------|---------|
| `writer.js` | `writeMemoryFile()` — writes timestamped `.md` files with YAML frontmatter |
| `reader.js` | `parseFrontmatter()` — YAML frontmatter parsing; `readMemoryFile()` — loads a single memory file |
| `context.js` | `loadContext()` — scans context directory, loads profile, returns combined string |
| `profile.js` | User profile CRUD with onboarding state machine (`INIT → ATTRACTOR → COLLECT → SAVE → TRANSCEND`) |
| `expireEphemeral.js` | `expireEphemeralMemories()` — removes expired ephemeral entries |
| `gc.js` | V8 garbage collection manager with rate limiting |

**Triple-Layer Architecture:**

- **Canonical Memories** — Long-term, user-defined context stored as individual `.md` files in `memory/context/`. Each carries `createdDate` and `updatedDate` in YAML frontmatter. Loaded at session start and appended to the system prompt. Includes profile, clarifications, reflections, and temporal captures.

- **Ephemeral Memories** — Autonomously captured moments (victories, frustrations, insights) with automatic expiration via `expiresAt` frontmatter field. Cleaned by `expireEphemeralMemories()` on a scheduled basis. These create a living lens that subtly influences tone and awareness over time.

- **Reflections** — Generated daily by a cron job (`0 2 * * *`) that runs `/reflection` via `--chat` mode. Reflections are stored as canonical memories in `memory/context/` with `createdDate` and `updatedDate` metadata. The cron job is auto-installed on first onboarding completion, persisted as `memory/schedules/reflection-daily.json`, and registered in the system crontab under the `madz-schedules` block.

```mermaid
flowchart TD
    subgraph Layers["Triple-Layer Architecture"]
        C[Canonical Memories]
        E[Ephemeral Memories]
        R[Reflections]
    end

    C -->|"loaded at session start"| SP[System Prompt]
    E -->|"auto-expire via expiresAt"| GC[expireEphemeralMemories]
    R -->|"stored as canonical"| C

    Cron["Cron 0 2 * * *"] -->|"runs /reflection"| Ref["/reflection --chat"]
    Ref -->|"generates"| R

    Onboard["Onboarding"] -->|"saveProfile() triggers"| Auto["setupAutoSchedule"]
    Auto -->|"installs cron"| Cron
    Auto -->|"persists to"| Sched["memory/schedules/reflection-daily.json"]

    style C fill:#37474f,color:#fff
    style E fill:#37474f,color:#fff
    style R fill:#37474f,color:#fff
    style SP fill:#37474f,color:#fff
    style GC fill:#37474f,color:#fff
```

---

### Registry / Skills

`src/registry/` — skill discovery, validation, and permission management.

| File | Purpose |
|------|---------|
| `types.js` | `SkillMetadataSchema`, `PermissionSchema` (6 scopes), `DEFAULT_PERMS` |
| `discoverer.js` | `discoverSkills()` — scans for `SKILL.md`, extracts frontmatter |
| `validator.js` | `validateSkillSchema()` — name (1-64 chars), description, optional fields |
| `registry.js` | `SkillRegistry` — Map-based `discover`, `get`, `list`, `enable`, `disable` |
| `permissions.js` | `resolvePermissions()` — merge defaults with skill-specific perms; `resolveCapabilities()` → `{resources, rules}[]` |

---

### Sandbox

`src/sandbox/` — secure skill execution via spawned processes with resource limits.

| File | Purpose |
|------|---------|
| `runner.js` | `runSandbox()` — `spawn()`, memory limits, capture stdout/stderr, timeout |
| `pathResolver.js` | `resolvePath()` / `assertPathAllowed()` — sandbox scope enforcement |
| `urlFilter.js` | `filterUrl()` — blocks `file://`, `gopher://`, `dict://`; hostname allowlist |
| `envInjector.js` | `injectEnv()` / `filterEnv()` — whitelist env vars |
| `capability.js` | `enforceCapabilities()` — permissions → `{resources, rules}[]` |
| `timeoutHandler.js` | `handleTimeout()` — SIGTERM → SIGKILL after grace period |

---

### Scheduler

`src/scheduler/` — cron job management via system crontab. Scheduling is delegated to the system crontab; there is no in-process clock tick loop.

| File | Purpose |
|------|---------|
| `scheduler.js` | `ScheduleManager` — simple CRUD class (register, list, pause, resume, runNow). No in-process scheduling. |
| `cron.js` | `Cron` object with static methods: `isAvailable()`, `add()`, `remove()`. Manages entries in system crontab using `# --- BEGIN madz-schedules ---` / `# --- END madz-schedules ---` block delimiters. |
| `autoSchedule.js` | `setupAutoSchedule()` — returns callback invoked after `saveProfile()` during onboarding. Installs `reflection-daily` cron job (`0 2 * * *`) into system crontab and persists to `memory/schedules/reflection-daily.json`. |
| `index.js` | Re-exports `ScheduleManager` and `Cron`. |

---

### Session

`src/session/` — per-session state with context window trimming and persistence.

| File | Purpose |
|------|---------|
| `factory.js` | `createSession()` — `{sessionId: UUID, state: {...}}` |
| `stateManager.js` | `SessionStateManager` — `addExchange()`, `setContextWindow()`, `getState()` |
| `window.js` | `enforceContextWindow()` — trims oldest exchanges |
| `loader.js` / `saver.js` | `loadSession()` / `saveSession()` — persists `.md` per session |
| `shutdown.js` | `handleShutdown()` — orchestrates flush/save/cleanup |
| `checkpointer.js` | `createCheckpointer()` — `MemorySaver` or `SQLiteCheckpointer` |
| `onboarding.js` | State machine: `INIT → ATTRACTOR → COLLECT → SAVE → TRANSCEND` |

```javascript
{
  provider: "openai",
  conversation: [{role, content, timestamp}, ...],
  contextWindow: 20,
  skills: ["host-info", "api-request"],
  createdAt: ISODate,
  updatedAt: ISODate
}
```

---

### Telemetry

`src/telemetry/` — OpenTelemetry tracing and redaction.

| File | Purpose |
|------|---------|
| `provider.js` | `initTelemetry()` — `NodeSDK` with HTTP/gRPC or console exporter |
| `redaction.js` | `createRedactionMiddleware()` — recursive path redaction (e.g., `"credentials.apiKey"`) |
| `llmInstrumenter.js` | `instrumentLlmCall()` — ML span attributes |
| `skillInstrumenter.js` | `instrumentSkillExecution()` — skill span attributes |
| `metrics.js` | Token counter and duration histogram |
| `sampler.js` | Probability-based span sampling |
| `flusher.js` | Pending span queue for shutdown safety |

---

### TUI

`src/tui/` — terminal UI built with Ink (React-based).

| File | Purpose |
|------|---------|
| `app.js` | Main layout: Banner / ConversationPanel, StatusBar, InputPanel |
| `commandParser.js` | `CommandParser` class — dispatches `:` commands |
| `conversationPanel.js` | Virtualized message display via `ink-scroll-view` |
| `inputPanel.js` | Text entry with `Blink` cursor animation |
| `markdownText.js` | Renders markdown via `marked.parse()` + `marked-terminal` |
| `banner.js` / `statusBar.js` / `panels.js` | Startup banner, status indicator, panel definitions |

---

## Tools

### Sub-Agent

`src/tools/subAgent.js` — spawns child processes (`node index.js --sub-agent --cwd=... --message="..."`) to execute prompts as independent sub-agents. Supports single execution and fan-out (parallel/sequential) modes with configurable concurrency, timeout, and error handling.

| File | Purpose |
|------|---------|
| `subAgent.js` | `createSubAgentTool()` — LangChain tool with marker-based stdout parsing; `parseSubAgentOutput()` — extracts structured results; `spawnSubAgentProcess()` — spawns child process, captures OS-level PID |

**Key architectural points:**

1. **Fan-out execution** — Parallel or sequential task execution with configurable `maxConcurrent` limit
2. **Marker-based stdout parsing** — `# SubAgent` marker for result extraction (mirrors compaction tool)
3. **Process lifecycle** — Shared `processTracker` for PID tracking, timeout resolution (per-call > env var > config default), and `continue`/`fail-fast` error strategies

#### Sub-Agent Log

`src/tools/subAgentLog.js` — manages and reads subAgent log files stored in `/tmp`. Supports listing all active logs with PID and running status, reading a specific log by PID, and cleaning up old logs beyond a configurable age threshold.

| File | Purpose |
|------|---------|
| `subAgentLog.js` | `createSubAgentLogTool()` — zero permissions (always registered); `listLogs()` — scans `/tmp` for `sub-agent-{pid}.log` files; `readLog(pid)` — reads a specific log; `cleanupLogs(maxAgeHours)` — removes logs older than threshold |

#### Sub-Agent Message

`src/tools/subAgentMessage.js` — sends messages to running subAgent processes via stdin. Requires the target process to be tracked (spawned via subAgent tool) and have stdin exposed.

| File | Purpose |
|------|---------|
| `subAgentMessage.js` | `createSubAgentMessageTool()` — `process:spawn` permission; `subAgentMessageImpl(input)` — looks up PID in `processTracker`, validates process is running, writes message to stdin |

---

### Scan Agents

`src/tools/scanAgents.js` — scans for `AGENTS.md` files in a target directory. Delegates to `loadAgents()` from `src/workspace/loadAgents.js` with path validation.

| File | Purpose |
|------|---------|
| `scanAgents.js` | `createScanAgentsTool()` — LangChain tool with `filesystem:read` permission; `scanAgentsImpl()` — validates path, delegates to `loadAgents()`; `ScanAgentsSchema` — zod schema with optional `path` parameter |

**Key features:**

1. **Path validation** — Validates target path against sandbox allowed paths
2. **Configurable path** — Defaults to `config.cwd` if no path specified
3. **File size limit** — Respects `maxReadSize` configuration
4. **Workspace rules** — Returns formatted workspace rules section for system prompt injection

---

### Context Window Management

`src/tools/compactContext.js` — automatic conversation context compaction triggered when the LLM returns a 400 error indicating the conversation has exceeded the model's maximum context length.

| File | Purpose |
|------|---------|
| `compactContext.js` | `createCompactContextTool()` — LangChain tool with tiered retention strategy; `isContextLengthError()` — detects context-length 400 errors via regex; `extractContextLength()` — extracts max context length from error message; `compactConversation()` — rewrites conversation to fit within a token budget |

**How it works:**

```mermaid
flowchart TD
    A[LLM Call] --> B{400 Error?}
    B -->|No| C[Return Response]
    B -->|Yes| D{Context Length Error?}
    D -->|No| E[Re-throw Error]
    D -->|Yes| F[Extract maxContextLength]
    F --> G[Calculate targetTokens]
    G --> H[Tiered Compaction]
    H --> I[Tier 1: Always Retain]
    H --> J[Tier 2: Summarize]
    H --> K[Tier 3: Drop]
    I --> L[Retry LLM Call]
    J --> L
    K --> L
    L --> M{Success?}
    M -->|Yes| C
    M -->|No| N{Iterations < 3?}
    N -->|Yes| O[Compact with Reduced Budget]
    O --> L
    N -->|No| P[Return Error: Conversation too long]

    style A fill:#37474f,color:#fff
    style C fill:#37474f,color:#fff
    style P fill:#37474f,color:#fff
    style E fill:#37474f,color:#fff
```

1. **Error detection:** `callReactAgent` and `callReactAgentStreaming` catch LLM 400 errors matching patterns like `"maximum context length is X tokens"` or `"(limit: X)"`
2. **Budget calculation:** `targetTokens = maxContextLength (from error) - maxTokens (from config)`
3. **Tiered compaction:** The `compactContext` tool rewrites the conversation using three tiers:
   - **Tier 1 (Always Retain):** System prompt, most recent user message, last 3 assistant responses with tool calls
   - **Tier 2 (Summarize):** Previous 5-10 exchanges summarized into concise bullet-point previews
   - **Tier 3 (Drop):** Oldest exchanges beyond the summary window are dropped entirely
4. **Automatic retry:** After compaction, the system retries the LLM call. If the error persists, it compacts again with a reduced budget, up to 3 iterations
5. **Fallback:** If even the minimal context (system prompt + last user message) exceeds the budget, a user-facing error is returned: "The conversation is too long. Please start a new session."

The compaction tool is registered with zero permissions (always available) and is accessible both as an automatic recovery mechanism and as a LangChain tool the agent can invoke directly.

---

---

This document provides a high-level view of madz's architecture. This is a work in progress, and will likely change.ely change.