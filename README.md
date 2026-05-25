# Madz

**Your AI companion, built right into your terminal.**

`madz` is a customizable AI companion that adapts to how you work. It remembers your context, safely runs your custom skills, and automates repetitive tasks so you can focus on what matters.

[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-blue.svg)](LICENSE)
[![Node.js >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](tests/)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](coverage.txt)

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Running](#running)
- [TUI Navigation](#tui-navigation)
- [Features](#features)
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

- 🧠 **Remembers everything** → Persistent memory across sessions
- 🛠️ **Runs your custom skills** → Safely execute plugins & tools in a sandboxed runtime
- ⏱️ **Automates your routines** → Declare cron jobs in YAML and run on autopilot
- 💬 **Orchestrates conversations** → Multi-turn LLM chats with context-window management

## Features

### LLM Provider Abstraction

Configurable provider dispatch with automatic fallback, rate limiting, and context-window trimming. Supports OpenAI-compatible APIs and local models (e.g., Ollama).

### Agent

Wraps `@langchain/langgraph/prebuilt`'s `createReactAgentGraph` to produce a compiled ReAct agent that interleaves LLM reasoning with tool invocations. `createReactAgent(model, tools)` builds the agent from a provider model and a permission-gated tool array. `callReactAgent(agent, message)` runs the ReAct loop and returns the agent's final response.

### Built-in Tools

Bundled LangChain tools gated by sandbox permissions:

| Category | Tools |
|----------|-------|
| **Filesystem** | `read_file`, `write_file` (500KB cap), `patch` (9-strategy fuzzy matching + unified diff), `search_files` (ripgrep with native fs fallback) |
| **Terminal** | `terminal` — shell command execution (foreground/background); `process` — background process management (list, poll, wait, kill, write, pause, resume) |
| **Task Management** | `todo` — CRUD list persisted to `memory/tools/todo.json` |
| **Memory** | `memory` — key-value session memory with deduplication |
| **Search** | `session_search` — query past conversations by keyword, ID, or browse |
| **Clarification** | `clarify` — sends clarification questions to the user |
| **Skills** | `skills_list` — lists discovered skills; `skill_view` — views skill metadata and SKILL.md |

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

Conversations, tool outputs, errors, and schedules are persisted as timestamped Markdown files with YAML frontmatter. Easy to audit with `git log` and re-load across sessions.

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
| `Tab`     | Switch tabs (conversation → memory → skills → settings) |
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
    ├── conversations/
    ├── context/
    ├── tools/
    └── schedules/
```

## Config Reference

| Section        | Key                   | Default            | Description                           |
|----------------|-----------------------|--------------------|---------------------------------------|
| `providers`    | `default`             | `openai`           | Primary LLM provider                  |
|                | `fallback_order`      | `[openai, local]`  | Fallback chain on failure             |
|                | `openai.model`        | `gpt-4o`           | Model name                            |
|                | `openai.temperature`  | `0.7`              | Sampling temperature                  |
|                | `openai.maxTokens`    | `4096`             | Max output tokens                     |
| `sandbox`      | `scope`               | `["memory/", "tmp/"]` | Allowed filesystem paths           |
|                | `timeout.seconds`     | `30`               | Max execution time                    |
|                | `memoryLimit`         | `"512m"`           | Heap limit via `--max-old-space-size` |
| `telemetry`    | `enabled`             | `false`            | Enable OpenTelemetry export           |
|                | `exporter.protocol`   | `console`          | `console`, `http`, or `grpc`          |
|                | `sampling.ratio`      | `0.1`              | Trace probability                     |
| `schedules`    | `maxConcurrent`       | `1`                | Max parallel scheduled runs           |
| `session`      | `context_window_size` | `20`               | Exchange count before trimming        |

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

## Coverage

This project enforces 100% code coverage on every commit. The coverage report is generated to `coverage.txt` via `node --test --experimental-test-coverage`.

```
file               | line % | branch % | funcs % | uncovered lines
-------------------------------------------------------------
src/sandbox        |        |          |         | 
  capability.js    | 100.00 |  100.00  | 100.00  | 
  envInjector.js   | 100.00 |  100.00  | 100.00  | 
  pathResolver.js  | 100.00 |  100.00  | 100.00  | 
  urlFilter.js     | 100.00 |   93.75  | 100.00  | 
src/session        |        |          |         | 
  factory.js       | 100.00 |  100.00  | 100.00  | 
  stateManager.js  | 100.00 |  100.00  | 100.00  | 
  window.js        | 100.00 |   91.67  | 100.00  | 
src/tui            |        |          |         | 
  commandParser.js | 100.00 |   88.89  | 100.00  | 
  panels.js        | 100.00 |  100.00  | 100.00  | 
-------------------------------------------------------------
All files          | 100.00 |   94.07  | 100.00  | 
```

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

Reference env vars in `config.yaml` using `${ENV_VAR_NAME}` syntax. Supported variables:

| Variable         | Purpose                       |
|------------------|-------------------------------|
| `OPENAI_API_KEY` | OpenAI provider auth          |
| `AUTH_API_KEY`   | API key authentication        |
| `NODE_ENV`       | Environment (`production`, `development`) |

## License

Licensed under the [BSD-3-Clause](LICENSE) License.

Copyright (c) 2026 Jason Mulligan.
