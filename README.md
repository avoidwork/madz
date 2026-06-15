# Madz

**A personality-driven AI harness channeling Mads Mikkelsen's cinematic soul.** | [denkerne.ai](https://denkerne.ai)

[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-blue.svg)](LICENSE)
[![Node.js >= 24](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](#testing)
[![Coverage](https://img.shields.io/badge/coverage-93.37%25-brightgreen)](#testing)

`madz` is a Node.js AI harness that combines a terminal-based UI with structured skill execution and a distinctive personality. Drawn from Mads Mikkelsen's most iconic roles, it speaks with calm, precision, and quiet intensity — solving problems with style, remembering your context, safely running your skills, and automating the mundane. Everything is persisted as version-controllable Markdown files, making it easy to audit with `git log` and re-load across sessions. Built on LangGraph, OpenTelemetry, and Ink — with persistent memory, sandboxed skill execution, cron scheduling, and a React-powered TUI.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Running](#running)
  - [TUI Navigation](#tui-navigation)
- [Docker](#docker)
  - [Building](#building)
  - [Running](#running)
  - [SSH Access](#ssh-access)
  - [Environment Variables](#environment-variables)
  - [Encoding Reference](#encoding-reference)
- [Features](#features)
  - [Onboarding](#onboarding)
  - [LLM Provider Abstraction](#llm-provider-abstraction)
  - [Agent](#agent)
  - [Context Window Management](#context-window-management)
  - [Built-in Tools](#built-in-tools)
  - [Skills Registry](#skills-registry)
  - [Permission Gating](#permission-gating)
  - [Memory System](#memory-system)
  - [Sandbox RTE](#sandbox-rte)
  - [Telemetry](#telemetry)
  - [Cron Scheduler](#cron-scheduler)
- [Directory Structure](#directory-structure)
- [Logging](#logging)
- [Config Reference](#config-reference)
- [Testing](#testing)
- [Development](#development)
  - [Extending Skills](#extending-skills)
  - [Environment Variables Usage](#environment-variables-usage)
- [License](#license)

## Overview

- 🧠 **Remembers everything** → Persistent memory across sessions
- 🎭 **Personality with purpose** → Mads Mikkelsen's cinematic soul — quiet intensity, elegant precision
- 🛠️ **Runs your custom skills** → Safely execute plugins & tools in a sandboxed runtime
- ⏱️ **Automates your routines** → Declare cron jobs in YAML and run on autopilot
- 💬 **Orchestrates conversations** → Multi-turn LLM chats with context-window management

## Quick Start

- Faster rendering and snappier interactions
- Session browsing with interactive menu

### Docker Quick Start (Recommended)

```bash
docker pull avoidwork/madz:latest
docker run -d \
  --name madz \
  -p 2222:22 \
  -v ./memory:/app/memory \
  -v ./skills:/app/skills \
  -v ./logs:/home/madz/.cache/madz/logs \
  -e OPENAI_API_KEY="your-key" \
  avoidwork/madz:latest
ssh -p 2222 madz@localhost
```

The full `docker run` command with all optional variables is in the [Docker Environment Variables](#environment-variables) section below.

### Prerequisites

- **Node.js** 24 or later
- **npm** (included with Node.js)
- An LLM provider API key (e.g., `OPENAI_API_KEY`)

### Installation

```bash
git clone https://github.com/avoidwork/madz.git
cd madz
npm install
```

### Configuration

Copy `config.yaml` and set your LLM provider credentials. Environment variable references (`${VAR_NAME}`) are resolved at load time.

**Docker** — pass environment variables via `docker run` or provide `config.yaml` via a volume mount. All configurable variables are listed in the [Docker Environment Variables](#environment-variables) section.

For the full configuration reference with defaults, see the [Config Reference](#config-reference) table at the end of this document.

### Running

**Interactive TUI:**

```bash
npm start
# or
node index.js --mode interactive
```

**With V8 garbage collection enabled (production/containerized):**

```bash
node --expose-gc index.js --mode interactive
npm start -- --expose-gc
```

GC is automatically triggered during idle periods and can be manually invoked via the `/gc` TUI command.

**Single prompt (CLI mode):**

```bash
node index.js "What's the CPU load?"
```

**Batch / pipeline output:**

```bash
node index.js "Summarize memory/_index.md" --json
```

### TUI Navigation

| Key                          | Action                               |
| ---------------------------- | ------------------------------------ |
| `↑/↓`                        | Scroll conversation history          |
| `/help`                      | Show available commands              |
| `/quit`                      | Exit the application                   |
| `/provider set <name>`     | Switch LLM provider                  |
| `/config set <path> <value>`  | Mutate config at runtime             |
| `/<skill-name>`              | Invoke a discovered skill            |
| `/schedule list`, `/schedule pause <name>`, `/schedule resume <name>`, `/schedule run-now <name>` | Control the cron scheduler           |
| `/clear`                     | Clear conversation history           |
| `/new`                       | Start a fresh session                |
| `/gc`                        | Trigger manual V8 garbage collection |
| `/gc status`                 | Show GC availability and call count  |

## Docker

### Building

Build a single-architecture image:

```bash
npm run docker:build
```

For multi-architecture builds (requires `docker buildx create --name multiarch --use`):

```bash
npm run docker:build:all          # amd64 + arm64
npm run docker:build:amd64        # amd64 only
npm run docker:build:arm64        # arm64 only
```

### Running

Pull the prebuilt image (or [build locally](#building) for a custom image), then run:

```bash
docker pull avoidwork/madz:latest
docker run -d \
  --name madz \
  -p 2222:22 \
  -v ./memory:/app/memory \
  -v ./skills:/app/skills \
  -v ./logs:/home/madz/.cache/madz/logs \
  -e OPENAI_API_KEY="abc" \
  -e OPENAI_MODEL=Qwen/Qwen3.6-35B-A3B-FP8 \
  -e OPENAI_ENCODING=qwen2_base \
  -e OPENAI_BASE_URL=http://your.inference.lan:8000/v1 \
  -e OPENAI_MAX_TOKENS=61440 \
  -e SEARXNG_URL=https://your.searxng.lan/search \
  avoidwork/madz:latest
```

The example above maps the container SSH port `22` to the host port `2222` to avoid conflicts with any local SSH service. Change the host port as needed (`<host_port>:22`).

### SSH Access

The container includes `sshd` listening on port `22`. The `madz` user has **no password** — connect with:

```bash
ssh -p 2222 madz@localhost
```

Once deployed, the user connects as `madz` (no password) on the remapped port. On first login the `madz` user automatically `cd`s into `/app` and runs `npm start`. To get an interactive shell:

```bash
# Run the app in the background
npm start &

# Or start a fresh shell session
/bin/sh
```

Volume mounts (`memory/`, `skills/`) are owned by the `madz` user with group `node` for shared write access.

### Environment Variables

All configuration is controlled via environment variables in the `docker run` command. Variable names follow `UPPER_SNAKE_CASE` of the config key path (e.g., `sandbox.timeout.seconds` → `SANDBOX_TIMEOUT_SECONDS`). Container keys like `providers`, `credentials`, `timeout`, and `search` are dropped from the env var name.

**Essential:**

| Variable         | Required | Default   | Description          |
| ---------------- | -------- | --------- | -------------------- |
| `OPENAI_API_KEY` | Yes      | _(empty)_ | LLM provider API key |

**Optional — Providers:**

| Variable                     | Default                     | Description                |
| ---------------------------- | --------------------------- | -------------------------- |
| `OPENAI_BASE_URL`            | `https://api.openai.com/v1` | API endpoint URL           |
| `OPENAI_MODEL`               | `gpt-4o`                    | Model name                 |
| `OPENAI_ENCODING`            | _(auto)_                    | Tiktoken encoder name (see [Encoding Reference](#encoding-reference) below) |
| `OPENAI_TEMPERATURE`         | `0.4`                       | Sampling temperature (0–2) |
| `OPENAI_MAX_TOKENS`          | `4096`                      | Max output tokens          |
| `OPENAI_REQUESTS_PER_MINUTE` | `60`                        | Rate limit for API calls   |
| `OPENROUTER_API_KEY`         | _(empty)_                   | OpenRouter API key         |
| `OPENROUTER_MODEL`           | `openrouter/auto`           | OpenRouter model name      |

**Optional — Tools:**

| Variable                          | Default   | Description                         |
| --------------------------------- | --------- | ----------------------------------- |
| `FAL_API_KEY`                     | _(empty)_ | Fal.ai API key (image generation)   |
| `EXA_API_KEY`                     | _(empty)_ | Exa search API key                  |
| `FIRECRAWL_API_KEY`               | _(empty)_ | Firecrawl API key                   |
| `TAVILY_API_KEY`                  | _(empty)_ | Tavily search API key               |
| `PARALLEL_API_KEY`                | _(empty)_ | Parallel search API key             |
| `SEARXNG_URL`                     | _(empty)_ | SearXNG search instance URL         |
| `BING_API_KEY`                    | _(empty)_ | Bing search API key                 |
| `CUSTOM_SEARCH_URL`               | _(empty)_ | Custom search engine URL            |
| `CUSTOM_SEARCH_METHOD`            | _(empty)_ | Custom search HTTP method           |
| `CUSTOM_SEARCH_HEADERS`           | _(empty)_ | Custom search headers (JSON string) |
| `CUSTOM_SEARCH_QUERY_KEY`         | _(empty)_ | Custom search query key             |
| `CUSTOM_SEARCH_TITLE_FIELD`       | _(empty)_ | Custom search title field           |
| `CUSTOM_SEARCH_URL_FIELD`         | _(empty)_ | Custom search URL field             |
| `CUSTOM_SEARCH_DESCRIPTION_FIELD` | _(empty)_ | Custom search description field     |

**Optional — Sandbox:**

| Variable                       | Default                    | Description                                |
| ------------------------------ | -------------------------- | ------------------------------------------ |
| `SANDBOX_PATHS`                | `memory/, skills/, tmp/`   | Allowed filesystem paths (comma-separated) |
| `SANDBOX_TIMEOUT_SECONDS`      | `30`                       | Max execution time in seconds              |
| `SANDBOX_GRACE_PERIOD`         | `5`                        | Kill grace period in seconds               |
| `SANDBOX_MEMORY_LIMIT`         | `512m`                     | Heap limit (`--max-old-space-size`)        |
| `SANDBOX_URL_FILTER`           | `true`                     | Outbound URL blocking                      |
| `SANDBOX_PYTHON_IMPORT_HOOK`   | `true`                     | Prevent subprocess import                  |
| `SANDBOX_ENV_ALLOWLIST`        | `PATH, HOME, NODE_ENV`     | Allowed env vars (comma-separated)         |
| `SANDBOX_PERMISSIONS`          | _(none)_                   | Permission grants                          |
| `SANDBOX_MAX_READ_SIZE`        | `1mb`                      | Max file read size                         |
| `SANDBOX_SKILL_SCAN_PATHS`     | `skills/, .agents/skills/` | Skill scan paths (comma-separated)         |
| `SANDBOX_TRUST_PROJECT_SKILLS` | `true`                     | Trust skills in project root               |

**Optional — Memory:**

| Variable                    | Default             | Description                    |
| --------------------------- | ------------------- | ------------------------------ |
| `MEMORY_DIRECTORY`          | `memory/`           | Base directory for persistence |
| `MEMORY_CONTEXT_DIR`        | `memory/context/`   | Context file directory         |
| `MEMORY_TOOLS_DIR`          | `memory/tools/`     | Tool metadata directory        |
| `MEMORY_ERRORS_DIR`         | `memory/errors/`    | Error log directory            |
| `MEMORY_SCHEDULES_DIR`      | `memory/schedules/` | Cron result files directory    |
| `MEMORY_GC_ENABLED`         | `true`              | Enable V8 garbage collection   |
| `MEMORY_GC_IDLE_TIMEOUT_MS` | `300000`            | Idle timeout before GC (ms)    |
| `MEMORY_GC_MAX_GC_PER_HOUR` | `4`                 | Max GC calls per hour          |

**Optional — Telemetry:**

| Variable                             | Default                 | Description                    |
| ------------------------------------ | ----------------------- | ------------------------------ |
| `TELEMETRY_ENABLED`                  | `false`                 | Enable OpenTelemetry export    |
| `TELEMETRY_EXPORTER_PROTOCOL`        | `console`               | Exporter protocol              |
| `TELEMETRY_EXPORTER_ENDPOINT`        | `http://localhost:4318` | OTLP endpoint URL              |
| `TELEMETRY_EXPORTER_MAX_SIZE`        | `512`                   | Batch size before flush        |
| `TELEMETRY_EXPORTER_SCHEDULED_DELAY` | `5000`                  | Scheduled flush interval in ms |
| `TELEMETRY_SAMPLING_RATIO`           | `0.1`                   | Trace probability              |

**Optional — Schedules:**

| Variable                   | Default     | Description                 |
| -------------------------- | ----------- | --------------------------- |
| `SCHEDULES_MAX_CONCURRENT` | `1`         | Max parallel scheduled runs |
| `SCHEDULES_MODE`           | `inprocess` | Scheduling backend          |

**Optional — TUI:**

| Variable          | Default | Description              |
| ----------------- | ------- | ------------------------ |
| `TUI_NAME`        | `madz`  | TUI identifier in banner |
| `TUI_CURSOR_CHAR` | `█`     | Cursor character         |

**Optional — Agent:**

| Variable                        | Default  | Description                                    |
| ------------------------------- | -------- | ---------------------------------------------- |
| `AGENT_RECURSION_LIMIT`         | `1000`   | Max graph execution steps per call             |
| `AGENT_AUTO_CONTINUE_LIMIT`     | `1000`   | Max consecutive auto-continue attempts before circuit breaker triggers |
| `AGENT_NODE_TIMEOUT`            | `600000` | Superstep timeout in milliseconds (default 10 minutes) |

**Optional — Persistence:**

| Variable                  | Default                 | Description              |
| ------------------------- | ----------------------- | ------------------------ |
| `PERSISTENCE_MODE`        | `memory`                | Storage backend          |
| `PERSISTENCE_SQLITE_PATH` | `memory/checkpoints.db` | SQLite checkpointer path |

**Alternative: inline env var references in `config.yaml`:**

Instead of passing env vars to `docker run`, reference them directly in `config.yaml`:

```yaml
providers:
  openai:
    credentials:
      apiKey: "${OPENAI_API_KEY}"
```

This is the recommended approach for container deployments — keep secrets out of `docker inspect` output.

### Encoding Reference

When using a non-OpenAI model (via `OPENAI_BASE_URL`), you may need to specify the tiktoken encoder name that matches the model's tokenizer. The `OPENAI_ENCODING` variable maps to the `encoding` field in the provider config and is used for token counting in the TUI status bar.

| Encoding           | Model Families                                          |
| ------------------ | ------------------------------------------------------- |
| `o200k_base`       | GPT-4o, GPT-4.1, GPT-5, o1, o3, o4-mini (and fine-tunes) |
| `cl100k_base`      | GPT-4, GPT-3.5-Turbo, text-embedding-ada-002, text-embedding-3-small/large |
| `p50k_base`        | text-davinci-002/003, code-davinci-001/002 (deprecated) |
| `r50k_base`        | text-davinci-001, text-curie/babbage/ada-001, davinci/curie/babbage/ada (deprecated) |
| `p50k_edit`        | text-davinci-edit-001, code-davinci-edit-001 (deprecated) |
| `gpt2`             | GPT-2                                                     |

For local models (Ollama, vLLM, LM Studio), check the model's tokenizer configuration. Common mappings:
- **Llama 3.x**: `cl100k_base` (most Llama models use a variant of the GPT-4 tokenizer)
- **Mistral**: `cl100k_base`
- **Qwen**: `qwen2_base`
- **Mixtral**: `cl100k_base`

If unsure, omit `OPENAI_ENCODING` — the TUI will fall back to character-count estimation.

## Features

### Onboarding

On first launch, `madz` starts an interactive onboarding flow that collects your profile — attractor (primary interest), expertise areas, dev tools, communication style preferences. This profile is stored as `memory/context/profile.md` and is loaded into the system prompt every session, making madz deeply personalized from the very first message. To re-trigger onboarding, delete `memory/context/profile.md` and restart.

### LLM Provider Abstraction

Configurable provider dispatch with rate limiting and context-window trimming. Supports OpenAI-compatible APIs.

### Agent

Wraps `@langchain/langgraph/prebuilt`'s `createReactAgentGraph` to produce a compiled ReAct agent that interleaves LLM reasoning with tool invocations. `createReactAgent(model, tools)` builds the agent from a provider model and a permission-gated tool array. `callReactAgent(agent, message)` runs the ReAct loop and returns the agent's final response.

### Context Window Management

When conversations grow long enough to exceed the model's maximum context length, `madz` automatically detects the error and triggers a compaction routine. A tiered retention strategy preserves high-fidelity information: the system prompt and the most recent exchanges are kept intact, older exchanges are summarized into concise bullet-point previews, and the oldest messages are dropped entirely. If a single compaction doesn't bring the context within budget, the system retries with progressively tighter limits — up to three iterations. If even the minimal context (system prompt + last user message) exceeds the budget, the user is presented with a clear error message. This happens transparently; the user never needs to start a new session or manually manage context.

### Built-in Tools

Bundled LangChain tools gated by sandbox permissions:

| Category            | Tools                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Filesystem**      | `read_file`, `write_file` (500KB cap), `patch` (9-strategy fuzzy matching + unified diff), `search_files` (ripgrep with native fs fallback)                                                                                                                                                                                                                                                                          |
| **Terminal**        | `terminal` — shell command execution (foreground/background); `process` — background process management (list, poll, wait, kill, write, pause, resume)                                                                                                                                                                                                                                                               |
| **Task Management** | `todo` — CRUD list persisted to `memory/tools/todo.json`                                                                                                                                                                                                                                                                                                                                                             |
| **Memory**          | `memory` — persistent memory tool with CRUD (create, read, update, delete, list). Each memory is stored as an individual `.md` file in `memory/context/` with `createdDate` and `updatedDate` metadata. Memories are long-term, core "canon" that shapes your interaction with madz — important personal details, preferences, and context that matter. Loaded into the system prompt at the start of every session. |
| **Search**          | `sessionSearch` — query past conversations by keyword, ID, or browse                                                                                                                                                                                                                                                                                                                                                |
| **Clarification**   | `clarify` — sends clarification questions to the user                                                                                                                                                                                                                                                                                                                                                                |
| **Utility**           | `sampling` — capture emotional moments as ephemeral memories (rate-limited); `date` — return current date/time (zero-permission, always registered)                                                                                                                                                                                                                                                                                         |
| **Skills**          | `skills_list` — lists discovered skills; `skillView` — views skill metadata and SKILL.md; `createSkill` — creates spec-compliant skill directories with SKILL.md frontmatter (requires `filesystem:write`)                                                                                                                                                                                                         |
| **Code**            | `executeCode` — code execution and analysis                                                                                                                                                                                                                                                                                                                                                                                 |
| **Web**             | `webSearch`, `web_extract` — outbound HTTP with timeout, URL allowlist filtering, multi-engine search backends                                                                                                                                                                                                                                                                                                                            |
| **Media**           | `image_generate` — image generation via fal.ai; `visionAnalyze` — vision/language analysis via OpenAI; `textToSpeech` — text-to-speech via OpenAI TTS                                                                                                                                                                                                                                                                                         |
| **Agents**          | `mixtureOfAgents` — multi-agent orchestration                                                                                                                                                                                                                                                                                                                                                                                    |
| **Cron**            | `cronJob` — cron job utilities                                                                                                                                                                                                                                                                                                                                                                                          |
| **System**          | `compactContext` — automatic conversation context compaction on LLM context-length errors (zero-permission, always registered)                                                                                                                                                                                                                                                                                         |

### Skills Registry

Auto-discovers Agent Skills spec-compliant skills from a `skills/` directory structure. Each skill directory contains a `SKILL.md` file with YAML frontmatter (`name` required, 1-64 lowercase alphanumeric + hyphens; `description` required, 1-1024 characters; optional `license`, `compatibility`, `metadata`). Supports optional `scripts/` subdirectory containing executable scripts (detected by extension: `.py`, `.sh`, `.js`, `.rb`, `.ts`). The `createSkill` tool lets agents create new skills programmatically — validating spec constraints before writing `SKILL.md` and optionally scaffolding a `scripts/` directory.

### Permission Gating

Built-in tools are registered only when their required permissions are enabled for the session. Tools like `clarify` have zero permissions and always register.

| Permission Required                 | Tools                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `filesystem:read`                   | `read_file`, `search_files`, `skillView`, `sessionSearch` |
| `filesystem:write`                  | `write_file`, `patch`, `todo`, `memory`, `createSkill`                    |
| `filesystem:exec` + `process:spawn` | `terminal`                                                                 |
| `process:spawn`                     | `process`                                                                  |
| _(none)_                            | `clarify`                                                                  |

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

Skills run in isolated spawned child processes with time limits, memory caps, and allowlists for filesystem paths and outbound URLs. Blocked schemes: `file://`, `gopher://`, `dict://`.

### Telemetry

Optional `@opentelemetry/sdk-node` integration. Configurable exporter (console, OTLP HTTP, OTLP gRPC), probability sampling, and automatic redaction of sensitive fields (API keys, auth headers).

### Cron Scheduler

Recurring job definitions in `config.yaml`. Scheduling is delegated to the system crontab — there is no in-process clock tick loop. Each invocation inherits the current session's memory context and sandbox permissions. Max-concurrency control prevents run overlap (currently a no-op, kept for API compatibility).

On first onboarding completion, `madz` automatically installs a `reflection-daily` cron job (`0 2 * * *`) into the system crontab. Job definitions are persisted as JSON in `memory/schedules/` and managed under the `madz-schedules` block.

## Directory Structure

```
/
├── index.js                    # Application entry point
├── config.yaml                 # Centralized configuration
├── .husky/                     # Git hooks (lint, fmt, tests)
├── src/
│   ├── agent/                  # ReAct agent wrapper (LangGraph)
│   ├── config/                 # YAML parsing & Zod schema validation
│   ├── logger.js               # Structured logging (pino)
│   ├── memory/                 # Markdown file persistence
│   ├── provider/               # LLM model factory (OpenAI)
│   ├── skills/                 # Agent Skills spec discovery, validation & permissions
│   ├── sandbox/                # Process sandboxing & capability enforcement
│   ├── scheduler/              # Cron-based job runner
│   ├── session/                # Per-session state & context windows
│   ├── telemetry/              # OpenTelemetry tracing & redaction
│   ├── tools/                  # Built-in LangChain tools
│   └── tui/                    # Ink React terminal UI
├── tests/
│   ├── unit/                   # Unit tests per module
│   └── integration/            # End-to-end flow tests
└── memory/                     # Persistent markdown storage
```

## Logging

Structured JSON logging via `pino` with OS-aware directory detection. Two log files are produced:

| File                | Level       | Description                       |
| ------------------- | ----------- | --------------------------------- |
| `madz.log`          | `info`+     | All info, warn, debug, error, fatal |
| `madz_error.log`    | `error`/`fatal` | Error-level entries only    |

**Log directory by platform:**

| Platform     | Path                          | Detection                          |
| ------------ | ----------------------------- | ---------------------------------- |
| Alpine       | `~/.cache/madz/logs/`         | `/etc/alpine-release` exists       |
| Linux        | `~/.local/share/madz/logs/`   | Default (XDG)                      |
| macOS        | `~/Library/Logs/madz/`        | `process.platform === "darwin"`    |
| Windows      | `%LOCALAPPDATA%\madz\logs\`   | `process.platform === "win32"`     |

The directory is created automatically (`mkdirSync({ recursive: true })`). If the configured directory is unwritable, the logger falls back to `os.tmpdir()/madz/logs/`. If that also fails, logs are silently discarded (no crash).

During test execution (`NODE_ENV=test`), the logger operates in silent mode—no files are written.

Graceful shutdown flushes all buffered log entries to disk before process exit.

## Config Reference

| Section       | Key                                  | Default                                  | Description                                   |
| ------------- | ------------------------------------ | ---------------------------------------- | --------------------------------------------- |
| `providers`   | `openai.type`                        | `openai`                                 | LLM provider type                             |
|               | `openai.base_url`                    | `https://api.openai.com/v1`              | API endpoint URL                              |
|               | `openai.model`                       | `gpt-4o`                                 | Model name                                    |
|               | `openai.credentials.apiKey`          | _(empty)_                                | API key for authentication                    |
|               | `openai.temperature`                 | `0.4`                                    | Sampling temperature (0–2)                    |
|               | `openai.maxTokens`                   | `4096`                                   | Max output tokens                             |
|               | `openai.rateLimit.requestsPerMinute` | `60`                                     | Rate limit for API calls                      |
| `sandbox`     | `paths`                              | `["memory/", "skills/", "tmp/"]` | Allowed filesystem paths                      |
|               | `timeout.seconds`                    | `30`                                     | Max execution time in seconds                 |
|               | `timeout.gracePeriod`                | `5`                                      | Kill grace period in seconds                  |
|               | `memoryLimit`                        | `"512m"`                                 | Heap limit (`--max-old-space-size`)           |
|               | `safety.urlFilter`                   | `true`                                   | Outbound URL blocking                         |
|               | `safety.pythonImportHook`            | `true`                                   | Prevent subprocess import                     |
|               | `env.allowlist`                      | `["PATH", "HOME", "NODE_ENV"]`           | Allowed environment variables                 |
|               | `permissions`                        | `["filesystem:read", ...]`               | Permission grants                             |
|               | `maxReadSize`                        | `"1mb"`                                  | Max file read size                            |
|               | `skillScanPaths`                     | `["skills/", ".agents/skills/"]`         | Skill discovery paths (comma-separated)       |
|               | `trustProjectSkills`                 | `true`                                   | Trust skills in project root                  |
| `memory`      | `directory`                          | `memory/`                                | Base directory for persistence                |
|               | `contextDir`                         | `memory/context/`                        | Context file directory                        |
|               | `toolsDir`                           | `memory/tools/`                          | Tool metadata directory                       |
|               | `errorsDir`                          | `memory/errors/`                         | Error log directory                           |
|               | `schedulesDir`                       | `memory/schedules/`                      | Cron result files directory                   |
|               | `gc.enabled`                         | `true`                                   | Enable V8 garbage collection                  |
|               | `gc.idleTimeoutMs`                   | `300000`                                 | Idle timeout before GC triggers (ms)          |
|               | `gc.maxGcPerHour`                    | `4`                                      | Max GC calls per hour                         |
|               | `ephemeral.ttlDays`                  | `7`                                      | TTL for ephemeral memories in days            |
|               | `ephemeral.maxEntries`               | `10`                                     | Max concurrent ephemeral entries              |
| `telemetry`   | `enabled`                            | `false`                                  | Enable OpenTelemetry export                   |
|               | `exporter.protocol`                  | `console`                                | Exporter protocol (`console`, `http`, `grpc`) |
|               | `exporter.endpoint`                  | `http://localhost:4318`                  | OTLP endpoint URL                             |
|               | `exporter.batch.maxSize`             | `512`                                    | Batch size before flush                       |
|               | `exporter.batch.scheduledDelay`      | `5000`                                   | Scheduled flush interval in ms                |
|               | `sampling.ratio`                     | `0.1`                                    | Trace probability                             |
|               | `redact.paths`                       | `["credentials.apiKey", ...]`            | Sensitive field paths for redaction           |
| `schedules`   | `maxConcurrent`                      | `1`                                      | Max parallel scheduled runs                   |
|               | `mode`                               | `inprocess`                              | Scheduling backend (`inprocess`, `system`)    |
|               | `syncOnInit`                         | `true`                                   | Sync crontab from persisted job definitions   |
| `tui`         | `name`                               | `madz`                                   | TUI identifier in banner                      |
|               | `cursorChar`                         | `█`                                      | Cursor character                              |
| `agent`       | `recursionLimit`                     | `1000`                                   | Max graph execution steps per agent call      |
|               | `autoContinueLimit`                  | `1000`                                   | Max consecutive auto-continue attempts before circuit breaker triggers |
|               | `nodeTimeout`                        | `600000`                                 | Superstep timeout in milliseconds (default 10 minutes) |
| `persistence` | `mode`                               | `memory`                                 | Storage backend (`memory`, `sqlite`)          |
|               | `sqlite_path`                        | `memory/checkpoints.db`                  | SQLite checkpointer file path                 |

## Testing

```bash
# Run all tests
npm run test

# Generate coverage report
npm run coverage

# Auto-fix lint & formatting
npm run fix

# Check lint & formatting (no fix)
npm run lint
```

The pre-commit hook runs linting, formatting, and tests (targeting 100% code coverage). A commit will fail if any gate does not pass.

## Development

```bash
npm install
npm run fix          # Format and lint-fix all files
npm run test         # Verify changes
npm run coverage     # Generate and verify 100% coverage
```

### Extending Skills

Skills follow the [Agent Skills spec](https://agentskills.io/specification). Each skill is a directory under `skills/` containing a `SKILL.md` file with YAML frontmatter.

**Programmatic creation:** Use the `createSkill` tool to create new skills from within agent conversations. The tool validates the name (lowercase alphanumeric + hyphens, 1-64 chars), description (1-1024 chars), and optional fields (`license`, `compatibility`, `metadata`) against spec constraints before writing `SKILL.md`. It can optionally scaffold a `scripts/` subdirectory with a `README.md` placeholder for executable scripts.

**Manual creation:**

1. Create a directory under `skills/your-skill/`.
2. Add a `SKILL.md` file with YAML frontmatter:
   ```yaml
   ---
   name: your-skill
   description: What this skill does and when to use it.
   license: Apache-2.0          # optional
    compatibility: Node.js 24+   # optional, max 500 chars
   metadata:
     author: me
     version: "1.0"             # optional string map
   ---
   Step-by-step instructions for the agent...
   ```
3. (Optional) Place executable scripts under `skills/your-skill/scripts/`. Supported extensions: `.py` (Python 3), `.sh` (Bash), `.js`/`.mjs` (Node.js), `.rb` (Ruby), `.ts` (Node.js + tsx).
4. Restart the harness — the skills registry auto-discovers new skills on boot.

### Environment Variables Usage

`madz` supports two environment variable patterns:

1. **Direct override** — set env vars to override `config.yaml` values. Names follow `UPPER_SNAKE_CASE` of the config key path, with container keys (`providers`, `credentials`, `timeout`, `search`, `ratelimit`) dropped from the name. For example:

   | Config Path                              | Env Var Name          |
   | ---------------------------------------- | --------------------- |
   | `providers.openai.credentials.apiKey`    | `OPENAI_API_KEY`      |
   | `sandbox.timeout.seconds`                | `SANDBOX_SECONDS`     |
   | `search.exa.apiKey`                      | `EXA_API_KEY`         |
   | `telemetry.exporter.endpoint`            | `TELEMETRY_EXPORTER_ENDPOINT` |

   Docker users: see the [Environment Variables](#environment-variables) section under Docker for the full table.

2. **Inline reference in `config.yaml`** — use `${VAR_NAME}` syntax in config values:

```yaml
providers:
  openai:
    credentials:
      apiKey: "${OPENAI_API_KEY}"
```

For Docker-specific configuration, see the [Environment Variables](#environment-variables) section under Docker.

See [Config Reference](#config-reference) for the full list of configuration keys and their defaults.

## License

Licensed under the [BSD-3-Clause](LICENSE) License.

Copyright (c) 2026 Jason Mulligan.
