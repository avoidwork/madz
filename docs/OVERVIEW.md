# Architecture Overview

This document describes how madz is structured, how subsystems interact, and the key data flows through them. It covers the runtime components — not how to configure or contribute code (see [CODE_STYLE.md](./CODE_STYLE.md) instead).

---

## Table of Contents

- [System Diagram](#system-diagram)
- [Entry Point](#entry-point)
- [Config](#config)
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
       └──────────┘ └────▲─────┘ └────┬─────┘
              ┌──────────┘            │
              ▼                       ▼
       ┌────────────┐          ┌───────────┐
       │ Session    │◄─────────┤  Sandbox  │──► child_process.fork()
       └─────┬──────┘  session │  Runtime  │   skills/*/scripts/
             │                 └───────────┘
             │
             ▼
       ┌───────────┐
       │  Memory    │──► filesystem (memory/{conversations,context,schedules}/)
       │  Files     │
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
7. Defines `dispatchProvider()` — calls the provider with automatic fallback via `config.providers.fallback_order`
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
| `schemas.js` | Zod schemas for every config section: `ConfigSchema`, `ProvidersSchema`, `SandboxScopeSchema`, `MemorySchema`, `TelemetrySchema`, `SchedulesSchema`, `SessionSchema` |
| `loader.js` | Loads `config.yaml`, deep-merges with defaults, resolves env vars recursively, validates against Zod |

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

---

## Memory

`src/memory/` — persistent storage as timestamped Markdown files with YAML frontmatter.

**Key files:**

| File | Purpose |
|------|---------|
| `writer.js` | `writeMemoryFile()` — writes files named `YYYY-MM-DDTHH-mm-ss---[slug].md` with YAML frontmatter and markdown body |
| `reader.js` | `parseFrontmatter()` — regex-split YAML frontmatter / markdown body; `readMemoryFile()` — reads and parses a single file |
| `context.js` | `loadContext()` — scans `memory/context/` for `.md` files, sorts by timestamp (newest first), combines the last N bodies into a single context string |
| `retention.js` | `cleanRetainedMemory()` — deletes `.md` files older than N days; `enforceMaxEntries()` — deletes oldest files exceeding the max count |

**File format:**
```markdown
---
title: "Conversation 2026-05-24T12:00:00.000Z"
timestamp: "2026-05-24T12:00:00.000Z"
provider: "openai"
sessionId: "abc-123"
---

[user
{
  "role": "user",
  "content": "Hello"
}
```

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
| `parser.js` | `validateCron()` — regex-based 5/6-field cron syntax validation; `parseScheduleEntry()` — parses a config entry into a structured object with defaults |
| `queue.js` | `ScheduleQueue` — FIFO queue with `maxConcurrent` enforcement: `enqueue()`, `dequeue()`, `complete()`, `peek()` |
| `runner.js` | `runScheduledSkill()` — loads context file if specified, invokes sandbox with skill input and current session permissions |
| `logger.js` | `logScheduleResult()` — writes execution results to `memory/schedules/` as Markdown |
| `scheduler.js` | `ScheduleManager` — registers entries, manages the queue, runs `#clockTick` checks every N seconds, plus `pause()`, `resume()`, `runNow()` |

**Cron matching in `#clockTick()`:**

The `matchesField()` function supports literal values (`30`), ranges (`1-5`), step expressions (`*/15`), and wildcards (`*`). It checks minute and hour fields against the current time every tick interval (default 60 seconds).

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
| `app.js` | Main React component — 2-panel layout: conversation/skills/memory/settings (left), info sidebar (right), status line at bottom |
| `panels.js` | `PANELS` constant, `getPanelOrder()`, `nextPanel()`, `prevPanel()` — panel definitions and navigation |
| `inputPanel.js` | `InputPanel` — text entry with enter-to-send, backspace support, `>` prompt for messages |
| `conversationPanel.js` | `ConversationPanel` — virtualized message display with scroll (up/down keys) |
| `skillsPanel.js` | `SkillsPanel` — lists registered skills with keyboard focus navigation and search |
| `memoryPanel.js` | `MemoryPanel` — entry list + detail view split |
| `settingsPanel.js` | `SettingsPanel` — config sections list with selection detail |
| `commandParser.js` | `CommandParser` class — dispatch table for `:` commands: `quit`, `provider set`, `config set`, `memory open/search`, `schedule list/pause/resume/run-now`, `context add`, `help` |
| `messages.js` | `getRoleLabel()`, `calcVisibleCount()`, `getVisibleMessages()` (virtualized windowing), `countMessageLines()` |
| `hooks.js` | `createPanelState()` — initial state factory; `nextPanel()`, `prevPanel()` |
| `components.js` | Re-exports all panel components |

**Command system:**

Input starting with `:` is parsed by `CommandParser.parse(input, context)`. The context object contains references to the live session state, config mutator, and schedule manager:

| Command | Result |
|---|---|
| `:quit` | `{action: "quit", value: true}` |
| `:provider set local` | `{action: "provider", subAction: "set", value: "local"}` |
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
    │     ├── callProvider("openai", ...)                        ← fetches from LLM
    │     └── callProvider("local") ← fallback
    ├── sessionState.addExchange({role: "assistant", content})
    └── writeMemoryFile("memory/conversations", ...)             ← persists to filesystem
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
