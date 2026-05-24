# madz

AI Harness — a keyboard-driven terminal interface for orchestrating LLM conversations, sandboxed skill execution, memory persistence, and scheduled workflows.

[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-blue.svg)](LICENSE)
[![Node.js >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](tests/)

## Overview

madz is a Node.js AI harness that combines a terminal-based user interface with structured skill execution. It provides:

- **Chat with an LLM** — interact through a full TUI or a simple chat mode.
- **Sandboxed skill runner** — execute tools with filesystem, network, and process scope enforcement.
- **Persistent markdown memory** — every conversation, tool output, and execution log is stored as version-controllable `.md` files.
- **Cron-based scheduling** — declare recurring workflows in `config.yaml`.
- **OpenTelemetry observability** — trace LLM calls, skill runs, and sandbox exports with redaction.
- **Session management** — per-session context windows and runtime config mutation.

## Features

### LLM Provider Abstraction

Configurable provider dispatch with automatic fallback, rate limiting, and context-window trimming. Supports OpenAI-compatible APIs and local models (e.g., Ollama).

### Skills Registry

Auto-discovers skills from a `skills/` directory structure. Each skill defines input/output schemas via Zod permissions (`filesystem:read`, `network:outbound`, `process:spawn`, etc.) and is executed inside a sandboxed Node.js process.

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
madz/
├── index.js                    # Application entry point
├── config.yaml                 # Centralized configuration
├── .husky/                     # Git hooks (lint, fmt, tests)
├── src/
│   ├── config/                 # YAML parsing & Zod schema validation
│   ├── memory/                 # Markdown file persistence
│   ├── registry/               # Skill discovery, validation & permissions
│   ├── sandbox/                # Process sandboxing & capability enforcement
│   ├── scheduler/              # Cron-based job runner
│   ├── session/                # Per-session state & context windows
│   ├── telemetry/              # OpenTelemetry tracing & redaction
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

The pre-commit hook runs linting, formatting, type-checking, and tests. A commit will fail if any gate does not pass.

## Development

```bash
npm install
npm run fix          # Format and lint-fix all files
npm run test         # Verify changes
npm run coverage     # Ensure 100% coverage
```

### Extending Skills

1. Create a directory under `skills/your-skill/`.
2. Add a `skill.yaml` or `skill.json` defining `name`, `version`, `description`, `permissions`, and input/output schemas.
3. Place executable scripts under `skills/your-skill/scripts/`.
4. Restart the harness — the registry auto-discovers new skills on boot.

### Adding Environment Variables

Reference env vars in `config.yaml` using `${ENV_VAR_NAME}` syntax. Supported variables:

| Variable         | Purpose                       |
|------------------|-------------------------------|
| `OPENAI_API_KEY` | OpenAI provider auth          |
| `AUTH_API_KEY`   | API key authentication        |
| `NODE_ENV`       | Environment (`production`, `development`) |

## License

BSD-3-Clause — see [LICENSE](LICENSE) for details.
