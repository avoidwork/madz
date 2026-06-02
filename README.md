# Madz

**A personality-driven AI harness channeling Mads Mikkelsen's cinematic soul.**

`madz` is a terminal-native AI companion — helpful by design, delivered with precision, quiet intensity, and elegant flair. Drawn from Mads Mikkelsen's most iconic roles, it's an assistant that solves problems with style, remembers your context, safely runs your skills, and automates the mundane so you can focus on what matters.

[![Status: Beta](https://img.shields.io/badge/status-beta-orange.svg)](#)
[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-blue.svg)](LICENSE)
[![Node.js >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](tests/)
[![Coverage](https://img.shields.io/badge/coverage-98.30%25-brightgreen)](coverage.txt)

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Running](#running)
- [TUI Navigation](#tui-navigation)
- [Features](#features)
  - [Onboarding](#onboarding)
  - [LLM Provider Abstraction](#llm-provider-abstraction)
  - [Agent](#agent)
  - [Built-in Tools](#built-in-tools)
  - [Skills Registry](#skills-registry)
  - [Permission Gating](#permission-gating)
  - [Memory System](#memory-system)
  - [Sandbox RTE](#sandbox-rte)
  - [Telemetry](#telemetry)
  - [Cron Scheduler](#cron-scheduler)
- [Directory Structure](#directory-structure)
- [Config Reference](#config-reference)
- [Testing](#testing)
- [Development](#development)
  - [Extending Skills](#extending-skills)
  - [Environment Variables](#environment-variables)
- [License](#license)

## Overview

`madz` is a Node.js AI harness that combines a terminal-based user interface with structured skill execution. Everything — conversations, tool outputs, and execution logs — is persisted as version-controllable Markdown files, making it easy to audit with `git log` and re-load across sessions.

It speaks with a distinctive voice: calm, precise, a little wry. Whether you need it to debug a script, manage a todo list, or just get something done without the chatter, `madz` delivers.

- 🧠 **Remembers everything** → Persistent memory across sessions
- 🎭 **Personality with purpose** → Mads Mikkelsen's cinematic soul — quiet intensity, elegant precision
- 🛠️ **Runs your custom skills** → Safely execute plugins & tools in a sandboxed runtime
- ⏱️ **Automates your routines** → Declare cron jobs in YAML and run on autopilot
- 💬 **Orchestrates conversations** → Multi-turn LLM chats with context-window management

## Features

### Onboarding

On first launch, `madz` starts an interactive onboarding flow that collects your profile — attractor (primary interest), expertise areas, dev tools, communication style preferences. This profile is stored as `memory/context/profile.md` and is loaded into the system prompt every session, making madz deeply personalized from the very first message. To re-trigger onboarding, delete `memory/context/profile.md` and restart.

### LLM Provider Abstraction

Configurable provider dispatch with rate limiting and context-window trimming. Supports OpenAI-compatible APIs.

### Agent

Wraps `@langchain/langgraph/prebuilt`'s `createReactAgentGraph` to produce a compiled ReAct agent that interleaves LLM reasoning with tool invocations. `createReactAgent(model, tools)` builds the agent from a provider model and a permission-gated tool array. `callReactAgent(agent, message)` runs the ReAct loop and returns the agent's final response.

### Built-in Tools

Bundled LangChain tools gated by sandbox permissions:

| Category | Tools |
|----------|-------|
| **Filesystem** | `read_file`, `write_file` (500KB cap), `patch` (9-strategy fuzzy matching + unified diff), `search_files` (ripgrep with native fs fallback) |
| **Terminal** | `terminal` — shell command execution (foreground/background); `process` — background process management (list, poll, wait, kill, write, pause, resume) |
| **Task Management** | `todo` — CRUD list persisted to `memory/tools/todo.json` |
| **Memory** | `memory` — persistent memory tool with CRUD (create, read, update, delete, list). Each memory is stored as an individual `.md` file in `memory/context/` with `createdDate` and `updatedDate` metadata. Memories are long-term, core "canon" that shapes your interaction with madz — important personal details, preferences, and context that matter. Loaded into the system prompt at the start of every session. |
| **Search** | `session_search` — query past conversations by keyword, ID, or browse |
| **Clarification** | `clarify` — sends clarification questions to the user |
| **Skills** | `skills_list` — lists discovered skills; `skill_view` — views skill metadata and SKILL.md |
| **Code** | `code` — code execution and analysis |
| **Web** | `web` — web request utilities |
| **Media** | `image` — image processing; `vision` — vision/language analysis; `tts` — text-to-speech |
| **Agents** | `moa` — multi-agent orchestration |
| **Cron** | `cron` — cron job utilities |

### Skills Registry

Auto-discovers skills from a `skills/` directory structure. Each skill defines input/output schemas via Zod permissions (`filesystem:read`, `network:outbound`, `process:spawn`, etc.) and is executed inside a sandboxed Node.js process.

### Permission Gating

Built-in tools are registered only when their required permissions are enabled for the session. Tools like `clarify` have zero permissions and always register.

| Permission Required | Tools |
|---------------------|-------|
| `filesystem:read` | `read_file`, `search_files`, `skills_list`, `skill_view`, `session_search` |
| `filesystem:write` | `write_file`, `patch`, `todo`, `memory` |
| `filesystem:exec` + `process:spawn` | `terminal` |
| `process:spawn` | `process` |
| *(none)* | `clarify` |

### Memory System

Memories are stored as individual Markdown files in `memory/context/`. Each file carries `createdDate` and `updatedDate` metadata in YAML frontmatter and the memory content as the body. At the start of every session, all memories are loaded and appended to the system prompt with a header like "The following are important memories for the user:" — so they become part of the core context that guides every interaction.

This means memories are not ephemeral session state; they are persistent, long-term knowledge that accumulates over time. When you add, update, or delete a memory, follow it with `:new` so the current session picks up the change immediately.

**Memory tool actions:** `create` (new memory), `read` (get by key), `update` (modify by key), `delete` (remove by key), `list` (all memories, optional query filter)

### Sandbox RTE

Skills run in isolated forked processes with time limits, memory caps, and allowlists for filesystem paths and outbound URLs. Blocked schemes: `file://`, `gopher://`, `dict://`.

### Telemetry

Optional `@opentelemetry/sdk-node` integration. Configurable exporter (console, OTLP HTTP, OTLP gRPC), probability sampling, and automatic redaction of sensitive fields (API keys, auth headers).

### Cron Scheduler

Recurring job definitions in `config.yaml`. Each invocation inherits the current session's memory context and sandbox permissions. Max-concurrency control prevents run overlap.

## Quick Start

### Prerequisites

- **Node.js** 20 or later
- **npm** (included with Node.js)
- An LLM provider API key (e.g., `OPENAI_API_KEY`)

### Installation

```bash
git clone https://github.com/avoidwork/madz.git
cd madz
npm install
```

### Configuration

Copy and edit the provided `config.yaml`. The minimum required change is the provider credentials:

```yaml
providers:
  default: openai
  openai:
    type: openai
    base_url: "https://api.openai.com/v1"
    model: "gpt-4o"
    credentials:
      apiKey: "${OPENAI_API_KEY}"
```

Environment variable references (`${VAR_NAME}`) are resolved at load time.

### Running

**Interactive TUI:**

```bash
npm start
# or
node index.js --mode interactive
```

**Single prompt (CLI mode):**

```bash
node index.js "What's the CPU load?"
```

**Batch / pipeline output:**

```bash
node index.js "Summarize memory/_index.md" --json
```

## TUI Navigation

| Key       | Action                         |
|-----------|--------------------------------|
| `↑/↓`     | Scroll conversation history    |
| `:help`   | Show available commands        |
| `:config set <key> <value>` | Mutate config at runtime |
| `:skill <name>` | Invoke a discovered skill      |
| `:schedule pause` / `resume` | Control the cron scheduler |

## Directory Structure

```
/
├── index.js                    # Application entry point
├── config.yaml                 # Centralized configuration
├── .husky/                     # Git hooks (lint, fmt, tests)
├── src/
│   ├── agent/                  # ReAct agent wrapper (LangGraph)
│   ├── config/                 # YAML parsing & Zod schema validation
│   ├── memory/                 # Markdown file persistence
│   ├── provider/               # LLM model factory (OpenAI)
│   ├── registry/               # Skill discovery, validation & permissions
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

## Config Reference

| Section        | Key                                | Default                                   | Description                                       |
|----------------|------------------------------------|-------------------------------------------|---------------------------------------------------|
| `providers`    | `openai.type`                      | `openai`                                  | LLM provider type                                 |
|                | `openai.base_url`                  | `https://api.openai.com/v1`               | API endpoint URL                                  |
|                | `openai.model`                     | `gpt-4o`                                  | Model name                                        |
|                | `openai.credentials.apiKey`        | *(empty)*                                 | API key for authentication                        |
|                | `openai.temperature`               | `0.7`                                     | Sampling temperature (0–2)                        |
|                | `openai.maxTokens`                 | `4096`                                    | Max output tokens                                 |
|                | `openai.rateLimit.requestsPerMinute` | `120`                                   | Rate limit for API calls                          |
| `sandbox`      | `paths`                            | `["memory/", "skills/", "tmp/"]`          | Allowed filesystem paths                          |
|                | `timeout.seconds`                  | `30`                                      | Max execution time in seconds                     |
|                | `timeout.gracePeriod`              | `5`                                       | Kill grace period in seconds                      |
|                | `memoryLimit`                      | `"512m"`                                  | Heap limit (`--max-old-space-size`)               |
|                | `safety.urlFilter`                 | `true`                                    | Outbound URL blocking                             |
|                | `safety.pythonImportHook`          | `true`                                    | Prevent subprocess import                         |
|                | `env.allowlist`                    | `["PATH", "HOME", "NODE_ENV"]`            | Allowed environment variables                     |
|                | `permissions`                      | `["filesystem:read", ...]`                | Permission grants                                 |
|                | `maxReadSize`                      | `"1mb"`                                   | Max file read size                                |
| `memory`       | `directory`                        | `memory/`                                 | Base directory for persistence                    |
|                | `contextDir`                       | `memory/context/`                         | Context file directory                            |
|                | `toolsDir`                         | `memory/tools/`                           | Tool metadata directory                           |
|                | `errorsDir`                        | `memory/errors/`                          | Error log directory                               |
|                | `schedulesDir`                     | `memory/schedules/`                       | Cron result files directory                       |
| `telemetry`    | `enabled`                          | `false`                                   | Enable OpenTelemetry export                       |
|                | `exporter.protocol`                | `console`                                 | Exporter protocol (`console`, `http`, `grpc`)     |
|                | `exporter.endpoint`                | `http://localhost:4318`                   | OTLP endpoint URL                                 |
|                | `exporter.batch.maxSize`           | `512`                                     | Batch size before flush                           |
|                | `exporter.batch.scheduledDelay`    | `5000`                                    | Scheduled flush interval in ms                    |
|                | `sampling.ratio`                   | `0.1`                                     | Trace probability                                 |
|                | `redact.paths`                     | `["credentials.apiKey", ...]`             | Sensitive field paths for redaction               |
| `schedules`    | `maxConcurrent`                    | `1`                                       | Max parallel scheduled runs                       |
| `tui`          | `name`                             | `madz`                                    | TUI identifier in banner                          |
|                | `cursorChar`                       | `█`                                       | Cursor character                                  |
| `persistence`  | `mode`                             | `memory`                                  | Storage backend (`memory`, `sqlite`)              |
|                | `sqlite_path`                      | `memory/checkpoints.db`                   | SQLite checkpointer file path                     |

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

The pre-commit hook runs linting, formatting, type-checking, and tests (targeting 100% code coverage). A commit will fail if any gate does not pass.

## Development

```bash
npm install
npm run fix          # Format and lint-fix all files
npm run test         # Verify changes
npm run coverage     # Generate and verify 100% coverage
```

### Extending Skills

1. Create a directory under `skills/your-skill/`.
2. Add a `skill.yaml` or `skill.json` defining `name`, `version`, `description`, `permissions`, and input/output schemas.
3. Place executable scripts under `skills/your-skill/scripts/`.
4. Restart the harness — the registry auto-discovers new skills on boot.

### Environment Variables

Env vars can be used in two ways:

1. **Direct** — set env vars to override config values (listed below).
2. **Inline** — reference env vars in `config.yaml` using `${VAR_NAME}` syntax.

#### OpenAI Provider Options

| Variable                  | Config Key                           | Default                     |
|---------------------------|--------------------------------------|-----------------------------|
| `OPENAI_API_KEY`          | `providers.openai.credentials.apiKey`         | *(from config.yaml)*        |
| `OPENAI_BASE_URL`         | `providers.openai.base_url`             | `https://api.openai.com/v1` |
| `OPENAI_MODEL`            | `providers.openai.model`                | `gpt-4o`                    |
| `OPENAI_TEMPERATURE`      | `providers.openai.temperature`          | `0.7`                       |
| `OPENAI_MAX_TOKENS`       | `providers.openai.maxTokens`            | `4096`                      |
| `OPENAI_REQUESTS_PER_MINUTE` | `providers.openai.rateLimit.requestsPerMinute` | `120`                |

#### Sandbox Options

| Variable                   | Config Key                       | Default         |
|----------------------------|----------------------------------|-----------------|
| `SANDBOX_SECONDS`          | `sandbox.timeout.seconds`        | `30`            |
| `SANDBOX_GRACE_PERIOD`     | `sandbox.timeout.gracePeriod`    | `5`             |
| `SANDBOX_MEMORY_LIMIT`     | `sandbox.memoryLimit`            | `"512m"`        |

#### TUI Options

| Variable                     | Config Key                  | Default           |
|------------------------------|-----------------------------|-------------------|
| `TUI_NAME`                   | `tui.name`                  | `madz`            |
| `TUI_CURSOR_CHAR`            | `tui.cursorChar`            | `█`               |

#### Persistence Options

| Variable                     | Config Key                        | Default                       |
|------------------------------|-----------------------------------|-------------------------------|
| `PERSISTENCE_MODE`           | `persistence.mode`                | `memory`                      |
| `PERSISTENCE_SQLITE_PATH`    | `persistence.sqlite_path`         | `memory/checkpoints.db`       |

## License

Licensed under the [BSD-3-Clause](LICENSE) License.

Copyright (c) 2026 Jason Mulligan.
