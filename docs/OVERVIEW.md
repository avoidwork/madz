# Architecture Overview

This document describes how madz is structured, how subsystems interact, and the key data flows through them. It covers the runtime components — not how to configure or contribute code (see [CODE_STYLE.md](./CODE_STYLE.md) instead).

---

## Table of Contents

- [System Diagram](#system-diagram)
- [Entry Point](#entry-point)
- [Config](#config)
- [Provider](#provider)
- [Agent](#agent)
- [Tools](#tools)
- [Memory](#memory)
- [Registry / Skills](#registry--skills)
- [Sandbox](#sandbox)
- [Scheduler](#scheduler)
- [Session](#session)
- [Telemetry](#telemetry)
- [TUI](#tui)
- [Subsystem Interactions](#subsystem-interactions)

---

## System Diagram

```
                    ┌─────────────┐
                    │  config.yaml│
                    └──────┬──────┘
                           │ loadConfig()
                    ┌──────▼──────┐
                   ║    index.js  ║
                    └──┬───┬───┬──┘
              ┌────────┘   │   └────────┐
              ▼            ▼            ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │ Telemetry│ │ Registry │ │ Scheduler│
       └──────────┘    │        └────▲─────┘
              ┌─────────│─────────────│──────┐
              │         │             │      │
              ▼         ▼             │      │
       ┌────────────┐ ┌────────┐      │      │
       │  Provider  │ │ Agent  │      │      │
       └──────┬─────┘ └───┬────┘      │      │
              │           │tools      │      │
              │           ▼           │      │
              ├───► ┌──────────┐      │      │
              │     │  Sandbox  │◄─────┘      │
              │     │  Runtime │──► fork()    │
              │     └──────────┘   scripts/   │
              │                               │
              ▼                               ▼
       ┌───────────┐                  ┌────────────┐
       │  Memory    │──► filesystem   │  Session    │──► context window
       │  Files     │                └────────────┘
       └───────────┘
            │    ▲
      write/read    loadContext()
            │    │
            ▼    │
       ┌─────────────────┐
       │   TUI (Ink)     │◄── user input + commands
       │  ◄──────────────┘│── dispatchProvider(), invokeSkill()
       └─────────────────┘
```

---

## Entry Point

`index.js` bootstraps all subsystems and wires them together.

**Startup sequence:**

1. `loadConfig()` → reads `config.yaml`, deep-merges with `DEFAULT_CONFIG`, resolves env vars, validates against Zod
2. Conditionally boots Telemetry if `config.telemetry.enabled` is `true`
3. Creates a `SkillRegistry` and calls `discover("skills/")`
4. Loads the memory system (`src/memory/index.js`)
5. Creates a session (generates a UUID) and wraps it in a `SessionStateManager`
6. Creates a `ScheduleManager` with `config.schedules.maxConcurrent`
7. Defines `dispatchProvider()` — calls the configured LLM provider
8. Defines `handleConversation()` — adds user exchange, enforces context window, prepends context, dispatches to LLM, writes to memory
9. Defines `invokeSkill()` — looks up skill in registry, resolves permissions, invokes sandbox

**Shutdown sequence:**

1. Saves session to filesystem
2. Cleans retained memory (expiry + max entries)
3. Shuts down OpenTelemetry (flushes all pending spans)

**Exports for TUI:**
```
config │ sessionId │ sessionState │ registry │ tracer
dispatchProvider │ handleConversation │ invokeSkill
handleShutdown │ scheduleManager │ setConfigValue
loadContext │ writeMemoryFile │ readMemoryFile │ cleanRetainedMemory
```

---

## Config

`src/config/` — centralized YAML configuration with Zod validation, recursive env var resolution, and runtime mutation.

**Key files:**

| File | Purpose |
|------|---------|
| `schemas.js` | Zod schemas for every config section: `ConfigSchema`, `ProvidersSchema`, `SandboxScopeSchema`, `MemorySchema`, `TelemetrySchema`, `SchedulesSchema`, `SessionSchema`, `TuiSchema`, `RetentionSchema` |
| `loader.js` | Loads `config.yaml`, deep-merges with defaults, resolves env vars recursively, validates against Zod |
| `mutate.js` | `parseValue()` — string-to-JS-type coercion; `assignPath()` — dot-path mutation; `applyDotPathMutation()` — validates + mutates via Zod |

**Env var resolution (`_resolveEnvRecursively`):**

Walks the config tree recursively and maps each leaf key to an env var:

| Config Path | Env Var |
|---|---|
| `providers.openai.credentials.apiKey` | `OPENAI_API_KEY` |
| `providers.openai.base_url` | `OPENAI_BASE_URL` |
| `providers.openai.model` | `OPENAI_MODEL` |
| `sandbox.timeout.seconds` | `SANDBOX_TIMEOUT_SECONDS` |
| `memory.directory` | `MEMORY_DIRECTORY` |
| `telemetry.exporter.protocol` | `TELEMETRY_EXPORTER_PROTOCOL` |
| `schedules.maxConcurrent` | `SCHEDULES_MAX_CONCURRENT` |

- `'providers'` and `'credentials'` container keys are dropped from the env var name (they are implementation internals)
- CamelCase keys are converted to SNAKE_CASE (`maxConcurrent` → `MAX_CONCURRENT`)
- Strings from env are auto-parsed: `"true"` → `true`, `"42"` → `42`, `"3.14"` → `3.14`
- Legacy `${VAR_NAME}` interpolation is still supported as fallback

**Runtime mutation:** `setConfigValue(config, "telemetry.enabled", "true")` clones the config, applies the mutation at the dot-path, validates against the Zod schema, mutates the live config object, and persists to disk.

**Config mutation (`mutate.js`):** `parseValue()` converts strings to JS types; `assignPath()` mutates an object by dot-path; `applyDotPathMutation()` validates the patched config via Zod before applying.

---

## Provider

`src/provider/` — LLM provider factory that creates model instances from configuration.

**Key files:**

| File | Purpose |
|------|---------|
| `openai.js` | `createChatModel()` — factory that creates a `ChatOpenAI` instance from a `ProviderConfig`; `ProviderConfig` typedef defines `{ base_url, model, credentials: { apiKey }, temperature?, maxTokens? }` |

**Provider flow:**

1. `createChatModel(config)` receives a `ProviderConfig` — typically loaded from `config.providers.openai`
2. Returns a `ChatOpenAI` instance configured with the given base URL, model, credentials, temperature, and token limits
3. The provider instance is consumed by `Agent` (via `createReactAgent`) or `dispatchProvider()` in `index.js`

---

## Agent

`src/agent/` — ReAct agent wrapper around LangGraph's prebuilt agent builder. Provides a structured reasoning loop that interleaves LLM calls with tool invocations.

**Key files:**

| File | Purpose |
|------|---------|
| `react.js` | `createReactAgent()` — wraps `@langchain/langgraph/prebuilt`'s `createReactAgentGraph` to produce a compiled ReAct agent from a model and tool array; `callReactAgent()` — invokes the agent with a user message, returns the last message's content |

**Agent flow:**

1. `createReactAgent(model, tools)` compiles a LangGraph state graph with the given LLM model and tool definitions
2. `callReactAgent(agent, message)` feeds a user message into the compiled agent
3. The agent internally runs the ReAct loop: reason → call tool(s) → reason again → produce final answer
4. Returns `{ content: string }` containing the agent's final response

**Relationship to tools:** The agent's tool array is built by `buildToolConfig()` from `src/tools/index.js`, which gates LangChain tool definitions on sandbox permissions. Zero-permission tools like `clarify` are always available.

---

## Tools

`src/tools/` — built-in LangChain tools gated by sandbox permissions. Tools are registered conditionally based on the session's enabled permission set.

**Key files:**

| File | Purpose |
|------|---------|
| `index.js` | `TOOL_PERMISSIONS` — maps tool names to required permission scopes; `buildToolConfig()` — filters tools by enabled permissions and returns LangChain tool definitions |
| `filesystem.js` | `read_file` — read files with line-numbered output; `write_file` — write files with 500KB cap; `patch` — fuzzy-match patching with 9 strategies and unified diff output; `search_files` — ripgrep-based search with native `fs` fallback |
| `terminal.js` | `terminal` — shell command execution (foreground/background); `process_tool` — background process management (list, poll, log, wait, kill, write, pause, resume). Shared `processTracker` `Map` keyed by PID |
| `todo.js` | `todo` — CRUD task management persisted to `memory/tools/todo.json` |
| `memory.js` | `memory` — key-value entry storage. Each entry stored as an individual `.md` file with createdDate/updatedDate metadata. Actions: create, read, update, delete, list |
| `sessionSearch.js` | `session_search` — past conversation search (keyword query, full retrieval by ID, or browse) |
| `code.js` | `execute_code` / `code` — sandboxed code execution (python3, javascript, shell) with memory limits via POSIX `setrlimit` and import hooks for Python |
| `skills.js` | `skills_list` — lists all discovered skills from the registry; `skill_view` — views a single skill's metadata and SKILL.md content |
| `clarify.js` | `clarify` — sends clarification questions to the user. **Zero-permission tool** — always registered |
| `vision.js` | `vision_analyze` — image analysis via ChatOpenAI (requires `OPENAI_API_KEY`, no permission gating) |
| `image.js` | `image_generate` — image generation via fal.ai queue (requires `FAL_API_KEY`, `network:outbound` permission) |
| `tts.js` | `text_to_speech` — text-to-speech via OpenAI TTS API, saves MP3 to `~/voice-memos/` (requires `OPENAI_API_KEY`, no permission gating) |
| `moa.js` | `mixture_of_agents` — 4 parallel OpenRouter calls with aggregated analysis (requires `OPENROUTER_API_KEY`, no permission gating) |
| `cron.js` | `cronjob` — cron job CRUD operations for persistent scheduled tasks (requires `network:outbound` permission) |
| `common.js` | `validatePath()` — path vs. sandbox allowlist; `validateUrl()` — scheme + hostname allowlist; `fetchWithTimeout()` — HTTP GET with AbortController; `checkFileLimit()` / `parseSizeString()` — size validation |

**Permission gating in `buildToolConfig()`:**

| Tool | Required Permissions |
|------|---------------------|
| `read_file`, `search_files`, `skills_list`, `skill_view` | `filesystem:read` |
| `write_file`, `patch`, `todo`, `memory` | `filesystem:write` |
| `terminal` | `filesystem:exec` + `process:spawn` |
| `process` | `process:spawn` |
| `session_search` | `filesystem:read` |
| `execute_code` / `code` | *(none — always registered)* |
| `clarify` | *(none — always registered)* |
| `vision_analyze` | *(none — requires OPENAI_API_KEY)* |
| `text_to_speech` | *(none — requires OPENAI_API_KEY)* |
| `mixture_of_agents` | *(none — requires OPENROUTER_API_KEY)* |

---

## Memory

`src/memory/` — persistent storage as timestamped Markdown files with YAML frontmatter. Memories are the long-term "canon" — core details about the user that persist across sessions and are loaded into the system prompt at the start of every new conversation.

**Key files:**

| File | Purpose |
|------|---------|
| `writer.js` | `writeMemoryFile()` — writes files named `YYYY-MM-DDTHH-mm-ss---[slug].md` with YAML frontmatter and markdown body |
| `reader.js` | `parseFrontmatter()` — regex-split YAML frontmatter / markdown body; `readMemoryFile()` — reads and parses a single file |
| `context.js` | `loadContext()` — scans `memory/context/` for `.md` files, loads user profile via `profile.js`, loads context files sorted by timestamp, combines into a single context string |
| `retention.js` | `cleanRetainedMemory()` — deletes `.md` files older than N days; `enforceMaxEntries()` — deletes oldest files exceeding the max count |
| `loadMemories.js` | `loadMemories()` — loads all memory entries sorted by `updatedDate` descending → `createdDate`; `parseEntryFile()` — extracts `{ metadata, memory }` from a single entry; `formatMemoriesForPrompt()` — formats entries as markdown for the system prompt |
| `profile.js` | `loadProfile()` — reads user profile metadata from `memory/context/profile.md`; `saveProfile()` — sanitizes and writes; `formatProfileContext()` — formats profile for context insertion; `processOnboardingInput()` — attribute validation; `getAttribute()` — individual lookup. `ATTRIBUTES` defines known fields: `attractor`, `expertise`, `tools`, `voice`, `preferences` |

**Memory entries:**

Each memory is a standalone Markdown file in `memory/context/` with lowercase snake_case names. Files carry only date metadata in YAML frontmatter, with the memory body as the file content. The `memory` tool (documented in [Built-in Tools](#built-in-tools)) provides full CRUD: `create`, `read`, `update`, `delete`, and `list` actions.

**Memory system behavior:**

- At session start, `loadMemories()` reads all `.md` files from `memory/context/`, sorts by `updatedDate` descending (falling back to `createdDate`), and passes them to `formatMemoriesForPrompt()`
- The formatted output includes the user profile (from `memory/context/profile.md`) and user context files, appended to the system prompt with the prefix "The following are important memories for the user:" — making memories and profile part of the core context that guides every agent interaction
- When you add, update, or delete a memory, run `:new` to create a new session so the change takes effect immediately in the system prompt

---

## Registry / Skills

`src/registry/` — auto-discovers, validates, and manages skills from `skills/` directories.

**Key files:**

| File | Purpose |
|------|---------|
| `types.js` | Zod schemas: `SkillMetadataSchema`, `PermissionSchema` (enum of 6 scopes), `DEFAULT_PERMS = ["filesystem:read", "env:read"]` |
| `discoverer.js` | `discoverSkills()` — scans `skills/` subdirectories for `skill.yaml` or `skill.json`, loads metadata, attaches `_path` and `_directory` |
| `validator.js` | `validateSkillSchema()` — validates input/output schemas, then full metadata against `SkillMetadataSchema` |
| `registry.js` | `SkillRegistry` — Map-based store for skills with `discover`, `register`, `unregister`, `disable`, `enable`, `list`, `get` |
| `permissions.js` | `resolvePermissions()` — merges `DEFAULT_PERMS` with skill-specific permissions; `hasPermission()` — existence check; `resolveCapabilities()` — maps permission scopes to `{resources, rules}[]` capability objects |

**Permission scopes and their capability rules:**

| Permission | Capabilities |
|---|---|
| `filesystem:read` | `filesystem: read` |
| `filesystem:write` | `filesystem: read, write` |
| `filesystem:exec` | `filesystem: read, exec` |
| `network:outbound` | `network: outbound` |
| `process:spawn` | `process: spawn` |
| `env:read` | `env: read` |

---

## Sandbox

`src/sandbox/` — securely execute skill scripts in forked Node.js processes with resource limits.

**Key files:**

| File | Purpose |
|------|---------|
| `runner.js` | `runSandbox()` — forks a child process with `child_process.fork()`, sets `--max-old-space-size`, captures stdout/stderr, enforces timeout |
| `pathResolver.js` | `resolvePath()` — checks if a resolved path falls within allowed sandbox scope; `assertPathAllowed()` — throws `AccessDeniedError` if outside |
| `urlFilter.js` | `filterUrl()` — blocks `file://`, `gopher://`, `dict://`; optional hostname allowlist check; `isSchemeAllowed()` — scheme-only check |
| `envInjector.js` | `injectEnv()` — selects only whitelisted env vars from `process.env`; `filterEnv()` — filters an env object by whitelist |
| `capability.js` | `enforceCapabilities()` — maps permissions to `{resources, rules}[]` capability objects |
| `timeoutHandler.js` | `handleTimeout()` — sends SIGTERM after N seconds, then SIGKILL after grace period; returns `"terminated"`, `"killed"`, or `"running"` |

**Execution flow in `runSandbox()`:**

1. Resolve capabilities from permissions → produces a `rules` array
2. Filter the environment — only whitelisted vars are injected
3. Fork the child process with restricted `execArgv` memory limit
4. Collect stdout/stderr via `data` event listeners
5. Set up a timeout promise that sends SIGTERM → SIGKILL if needed
6. Wait for either normal exit or timeout → returns `{stdout, stderr, exitCode}`

---

## Scheduler

`src/scheduler/` — cron-based task scheduling with concurrency control, context inheritance, and result logging.

**Key files:**

| File | Purpose |
|------|---------|
| `parser.js` | `parseScheduleEntry()` — validates via `cron-parser` library, parses a config entry into a structured object with defaults |
| `matcher.js` | `matchesCron()` — full 5/6-field cron matching using `cron-parser` with timezone-safe comparison |
| `cronInstaller.js` | `CronInstaller` — `install()`, `uninstall()`, `list()` — manages schedules via user's system crontab (`crontab -`) |
| `queue.js` | `ScheduleQueue` — FIFO queue with `maxConcurrent` enforcement: `enqueue()`, `dequeue()`, `complete()`, `hasEntry()`, `getQueueLength()`, `peek()` |
| `runner.js` | `runScheduledSkill()` — async context file loading, `Promise.race` sandbox timeout, invokes sandbox with skill input and current session permissions |
| `logger.js` | `logScheduleResult()` — writes execution results to `memory/schedules/` as Markdown with sanitized filenames |
| `scheduler.js` | `ScheduleManager` — registers entries, manages the queue, computes next run via `cron-parser`, runs `#clockTick` checks every N seconds, plus `pause()`, `resume()`, `runNow()`, `status()` |

**Cron matching in `#clockTick()`:**

`cron-parser` is used for all expression evaluation. The `matchesCron()` matcher uses the "next from previous" technique — if the previous occurrence lands on the same minute (or second for a 6-field expression) as the current time, the job triggers. This correctly handles all standard cron fields: minute, hour, day-of-month, month, and day-of-week.

**System Cron Backend:**

The scheduler supports two modes: `inprocess` (default) runs on a timed tick, while `system` delegates to the user's system crontab. In system mode the in-process scheduler never starts; instead `CronInstaller.install()` writes schedule entries into the user's crontab and the system cron daemon handles execution.

---

## Session

`src/session/` — per-session state management with context window trimming, persistence, and graceful shutdown.

**Key files:**

| File | Purpose |
|------|---------|
| `factory.js` | `createSession()` — generates `{sessionId: UUID, state: {...}}` with a randomly generated UUID |
| `stateManager.js` | `SessionStateManager` — wraps session state with mutators: `setProvider()`, `addExchange()`, `registerSkill()`, `setContextWindow()`, `getState()` |
| `window.js` | `enforceContextWindow()` — trims oldest exchanges when `conversation.length > contextWindowSize`; `trimConversation()` — a reusable trim closure |
| `loader.js` | `loadSession()` — finds the latest `.md` file in the conversations directory and parses its frontmatter plus JSON body |
| `saver.js` | `saveSession()` — writes the current conversation state to a `.md` file with metadata |
| `shutdown.js` | `handleShutdown()` — orchestrates flush/save/cleanup; `registerShutdownHandler()` — listens for SIGTERM/SIGINT |
| `checkpointer.js` | `createCheckpointer(persistence)` — returns `MemorySaver` (in-memory) when `config` is `null`, or `SQLiteCheckpointer` (persistent) when `config.type` === `"sqlite"` |
| `onboarding.js` | `Onboarding` state machine — phases: `INIT → ATTRACTOR → COLLECT → SAVE → TRANSCEND` |

**Session state shape:**
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

## Telemetry

`src/telemetry/` — OpenTelemetry integration for tracing and redaction of sensitive data.

**Key files:**

| File | Purpose |
|------|---------|
| `provider.js` | `initTelemetry()` — creates a `NodeSDK` with either `OTLPTraceExporter` (HTTP/gRPC) or `ConsoleSpanExporter`; sets up probability sampling; attaches auto-instrumentations |
| `redaction.js` | `createRedactionMiddleware()` — recursively redacts nested dotted paths (e.g., `"credentials.apiKey"`); `redactAttributes()` — shallow redaction by substring match |
| `llmInstrumenter.js` | `instrumentLlmCall()` — creates `SpanData` attributes for ML calls (model, provider, token counts, latency) |
| `skillInstrumenter.js` | `instrumentSkillExecution()` — creates `SpanData` for skill invocations (skill name, duration, exit status) |
| `metrics.js` | `createTokenCounter()` — OpenTelemetry counter for input/output tokens; `createDurationHistogram()` — histogram for skill execution duration |
| `sampler.js` | `createSampler()` — probability-based span sampling; `loadSampler()` — creates a sampler from config |
| `flusher.js` | In-memory pending span queue (`queueSpan`, `flushPending`, `clearPending`) for shutdown safety |

---

## TUI

`src/tui/` — terminal user interface built with Ink (React-based TUI framework). Provides a multi-panel layout with keyboard navigation and a command dispatch system.

**Key files:**

| File | Purpose |
|------|---------|
| `index.js` | Partial re-export of TUI components: `App`, `CommandParser`, `PANELS`, `nextPanel`, `prevPanel`, `getPanelOrder`, `getRoleLabel`, `calcVisibleCount`, `getVisibleMessages`, `formatMessage`, `createPanelState`, `InputPanel`, `ConversationPanel`, `SkillsPanel`, `MemoryPanel`, `SettingsPanel`, `Banner` |
| `app.js` | Main React component — single-column vertical layout: OnboardingPanel / Banner / ConversationPanel, StatusBar, InputPanel, exit-newline Text |
| `onboardingPanel.js` | `OnboardingPanel` — interactive user profile onboarding flow with state machine, progress display, and input handling |
| `markdownText.js` | `MarkdownText` — React.memo component that renders markdown via `marked.parse()` with `marked-terminal` terminal styling |
| `banner.js` | `BANNER_ART` — ASCII ship art; `Banner` — BBS-style startup banner that dismisses on keypress |
| `statusBar.js` | `StatusBar` — bottom status bar with colored indicator (green/red/yellow) |
| `panels.js` | `PANELS` constant, `getPanelOrder()`, `nextPanel()`, `prevPanel()` — panel definitions and navigation |
| `inputPanel.js` | `InputPanel` — text entry with enter-to-send, backspace support, `>` prompt. Uses `Blink` component for cursor animation (no useEffect, no setInterval) |
| `conversationPanel.js` | `ConversationPanel` — virtualized message display with `ScrollView` from `ink-scroll-view`, scroll via up/down keys, React.memo `areEqual` guard |
| `skillsPanel.js` | `SkillsPanel` — lists registered skills with keyboard focus navigation |
| `memoryPanel.js` | `MemoryPanel` — entry list + detail view split |
| `settingsPanel.js` | `SettingsPanel` — config sections list with selection detail |
| `commandParser.js` | `CommandParser` class — dispatch table for `:` commands: `quit`, `provider set`, `config set`, `memory open/search`, `schedule list/pause/resume/run-now`, `context add`, `help` |
| `messages.js` | `getRoleLabel()`, `calcVisibleCount()`, `getVisibleMessages()` (virtualized windowing), `countMessageLines()`, `formatMessage()` — cached `Intl.DateTimeFormat` for time formatting |
| `hooks.js` | `createPanelState()` — initial state factory; `nextPanel()`, `prevPanel()` |
| `components.js` | Re-exports: `InputPanel`, `ConversationPanel`, `Blink`, `SkillsPanel`, `MemoryPanel`, `SettingsPanel`, `Banner`, `MarkdownText` |

**Command system:**

Input starting with `:` is parsed by `CommandParser.parse(input, context)`. The context object contains references to the live session state, config mutator, and schedule manager:

| Command | Result |
|---|---|
| `:quit` | `{action: "quit", value: true}` |
| `:provider set gpt-4` | `{action: "provider", subAction: "set", value: "gpt-4"}` |
| `:config set telemetry.enabled true` | `{action: "config", subAction: "set", path: "..."}` |
| `:memory open` | `{action: "memory", subAction: "open"}` |
| `:memory search daily` | `{action: "memory", subAction: "search", query: "daily"}` |
| `:schedule` | `{action: "schedule", list: [...]}` |
| `:schedule pause daily` | `{action: "schedule", subAction: "pause", name: "daily"}` |
| `:schedule run-now daily` | `{action: "schedule", subAction: "run-now", name: "daily"}` |
| `:context add some text` | `{action: "context", subAction: "add", value: "..."}` |
| `:help` | `{action: "help", message: "Available commands..."}` |

---

## Subsystem Interactions

**Conversation flow:**

```
index.js
  handleConversation(message)
    ├── sessionState.addExchange({role: "user", content: message})
    ├── enforceContextWindow(conversation, windowSize)          ← trims oldest exchanges
    ├── loadContext()                                            ← prepends context markdown
    ├── dispatchProvider(fullPrompt)
    │     ├── createChatModel("openai", ...)                    ← Provider
    │     ├── createReactAgent(model, tools)                    ← Agent
    │     └── callReactAgent(agent, message)                    ← ReAct loop
    ├── sessionState.addExchange({role: "assistant", content})
    └── writeMemoryFile("memory/sessions/", ...)             ← persists to filesystem

**Agent tool loop:**

```
callReactAgent(agent, message)
    ├── LLM decides to use a tool
    ├── buildToolConfig(permissions)                             ← filters tools by sandbox caps
    ├── terminal.read_file → validatePath(allowedPaths)
    ├── terminal.terminal    → validatePath + filterUrl
    ├── tools.clarify        → (zero-permission, always available)
    └── LLM produces final answer from tool outputs
```

**Skill invocation flow:**

```
index.js
  invokeSkill(scheduleName, input)
    ├── registry.get(scheduleName)
    ├── resolvePermissions(skillMetadata)                        ← merge with defaults
    ├── enforceCapabilities(permissions)                        ← {rules, resources}
    └── runSandbox({script, permissions, ...input})
          ├── resolvePath(scope, input.filePath)                ← sandbox path check
          ├── filterUrl(input.url)                              ← scheme + allowlist
          ├── filterEnv(allowlist)                              ← inject safe vars
          ├── child_process.fork(script, {stdio, ...})
          └── handleTimeout(seconds, gracePeriod)              ← SIGTERM → SIGKILL
```

**Scheduler flow:**

```
index.js
  ScheduleManager
    .register(config.schedules.entries)
    │     └── parseScheduleEntry(entry) ← schema validation
    .start(scheduler, intervalMs)
          └── setInterval(() => this.#clockTick(scheduler))
                ├── matches cron(minute, hour, now) ← simple minute-level matching
                │     └── queue.enqueue(entry)
                    └── scheduleQueue.dequeue()
                          └── runScheduledSkill(entry, sandbox, sessionState)
                                └── runSandbox(...)
                                └── logScheduleResult(...)                    → filesystem
```
