# Madz

**A security-first, self-contained autonomous coding agent.** | [denkerne.ai](https://denkerne.ai)

[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-blue.svg)](LICENSE)
[![Node.js >= 24](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](https://nodejs.org)
[![CI](https://github.com/avoidwork/madz/actions/workflows/ci.yml/badge.svg)](https://github.com/avoidwork/madz/actions/workflows/ci.yml)

`madz` is a complete development environment wrapped around an autonomous coding agent. The container ships a full toolchain (Node.js, Python, Ruby, Go, Java, Rust, Terraform, Chromium, and more), a [Deep Agents](https://github.com/langchain-ai/deepagentsjs) orchestrator with specialized subagents, a path- and URL-constrained tool layer, persistent memory, and a terminal UI. You run the container, reach the agent over SSH, and give it real work in environments where auditability and containment matter.

Everything it remembers is a Markdown file: memory, context, sessions, schedules, and skill definitions. `git log` is the audit trail.

## Quick Start

```bash
docker pull avoidwork/madz:latest
docker run -d \
  --name madz \
  -p 2222:22 \
  -v ./memory:/app/memory \
  -v madz-checkpoints:/app/memory/checkpoints \
  -v ./skills:/app/skills \
  -v ./tmp:/app/tmp \
  -v ./logs:/home/madz/.cache/madz/logs \
  -e OPENAI_API_KEY="your-key" \
  avoidwork/madz:latest
ssh -p 2222 madz@localhost
```

You need Docker and an LLM provider: either a cloud API key, or any local OpenAI-compatible server (Ollama, vLLM, LiteLLM, LM Studio, llama.cpp). For a local server, set `OPENAI_BASE_URL` and `OPENAI_MODEL`; no API key is needed.

On first login `madz` starts the TUI and runs a short onboarding flow to build your profile.

- Full `docker run` options, SSH details, and every environment variable: [docs/DOCKER.md](docs/DOCKER.md)
- A guided first conversation: [docs/TUTORIAL.md](docs/TUTORIAL.md)

### Running locally (development)

Requires Node.js 24 or later.

```bash
git clone https://github.com/avoidwork/madz.git
cd madz
npm install
npm start                       # interactive TUI
node index.js "What's the CPU load?"          # single prompt
node index.js "Summarize memory/_index.md" --json   # batch / pipeline output
```

To enable V8 garbage collection outside the container (the Docker image already does), invoke Node directly: `node --expose-gc index.js --mode interactive`.

| Argument               | Alias | Description                                                         |
| ---------------------- | ----- | ------------------------------------------------------------------- |
| `--mode`               | `-m`  | `chat` (default; one message, then exit) or `interactive` (the TUI) |
| `--session`            | `-s`  | Session ID to restore                                               |
| `message` (positional) | n/a   | Message to send (default: `"Hello"`)                                |

Inside the TUI, `/help` lists every command. The ones you will use most: `/new`, `/clear`, `/compact`, `/sessions`, `/memories`, `/skills`, `/subagents`, `/projects`, and `@` to autocomplete file paths. Terminal interface details live in [docs/TUI.md](docs/TUI.md).

## Why Madz

Most coding agents are a thin layer over a model. `madz` is the opposite: a working dev box with an agent at its center.

- **Self-contained.** Node.js, Python, Ruby, Go, Java (OpenJDK 21), Rust, Terraform, tflint, Chromium, ripgrep, git, the GitHub CLI, and npm/yarn/pnpm are all in the image. You can SSH in and do real work.
- **Security-first.** Filesystem access is confined to a path allowlist/denylist. Outbound URLs are filtered by scheme and hostname (`file://`, `gopher://`, `dict://`, and internal IP ranges are blocked). Built-in tools are gated by explicit permissions, skill metadata is schema-validated, and sensitive fields are redacted from telemetry. These are layered constraints that narrow what any single tool can reach. They are not a promise that the agent is harmless. The container boundary is the isolation boundary; see the [threat model](docs/THREAT_MODEL.md) for the honest description.
- **Autonomous.** An orchestrator routes work to 12 specialized subagents (code review, coding, debugging, security audit, testing, performance, research, and more) that read code, find bugs, write fixes, run tests, and open PRs.
- **Auditable.** State is plain Markdown under version control. You can show exactly what the agent did and why.
- **Local-first.** Data stays in your environment unless you configure otherwise. Secrets come only from environment variables and are never logged.

## Use Cases

- **Enterprise development.** One `madz` per project: a dedicated teammate with its own toolchain, semantic code search, context, and memory.
- **Security operations.** Run audits in an isolated container with a dedicated `security-audit` subagent, permission-gated tools, and URL filtering, without exposing your host.
- **Regulated and high-assurance environments.** Medical, financial, and government contexts that need auditability and data sovereignty. Every action is a version-controlled file.
- **Personal automation.** A persistent teammate that remembers your context and runs skills on a schedule.

## How It Works

```
┌───────────────────────────────────────────────────────────────┐
│  TUI (Ink / React)                     SSH (madz@host:2222)   │
│        │                                        │             │
│        └──────────────┬─────────────────────────┘             │
│                       ▼                                       │
│              ┌──────────────────────┐                         │
│              │  Deep Agents         │                         │
│              │  Orchestrator        │                         │
│              │  (primary + 12       │                         │
│              │   specialized        │                         │
│              │   subagents)         │                         │
│              └──────────┬───────────┘                         │
│                         │                                     │
│        ┌────────────────┼────────────────┐                    │
│        ▼                ▼                ▼                    │
│  ┌───────────┐   ┌────────────┐   ┌──────────────┐            │
│  │ Skills    │   │ LLM        │   │ Built-in     │            │
│  │ (SKILL.md │   │ provider   │   │ tools (30+)  │            │
│  │  files)   │   │ (OpenAI-   │   │ + deepagents │            │
│  │           │   │  compat)   │   │  filesystem) │            │
│  └───────────┘   └────────────┘   └──────────────┘            │
│                                                               │
│  Memory (Markdown) · Vector search (sqlite-vec) · Cron        │
└───────────────────────────────────────────────────────────────┘
```

The orchestrator routes tasks to subagents, each with a focused system prompt and a curated tool set. Tools are gated by permissions and by sandbox path and URL constraints. Skills are `SKILL.md` instruction files interpreted by the agent through the Deep Agents skill system. Everything is persisted as Markdown and indexed for semantic search. For the full architecture, see [docs/OVERVIEW.md](docs/OVERVIEW.md).

## The Personality

`madz` is built on a persona, the cinematic register of Mads Mikkelsen's roles, and it shapes how the agent talks to you: measured cadence, dry humor, a point of view, and memory of your context. The default is **Hannibal**; the others are chosen by the task.

| Character           | Source                       | When it shows up                                          |
| ------------------- | ---------------------------- | --------------------------------------------------------- |
| **Hannibal Lecter** | *Hannibal* (2013–2015)       | Code review, security audit, architectural critique       |
| **Le Chiffre**      | *Casino Royale* (2006)       | Debugging, tracing, mathematical problems, error analysis |
| **Galen Erso**      | *Rogue One* (2016)           | Building, fixing, designing systems, scaffolding          |
| **Martin**          | *Another Round* (2020)       | Brainstorming, exploring, when you're stuck               |
| **Claus**           | *Polar* (2019)               | Incident response, decisions under pressure               |

## Documentation

| Topic | Where |
| ----- | ----- |
| Docker, SSH, and all environment variables | [docs/DOCKER.md](docs/DOCKER.md) |
| Providers, agents, built-in tools, MCP, skills, permissions, memory, sandbox, telemetry, vector search, cron | [docs/FEATURES.md](docs/FEATURES.md) |
| Every `config.yaml` key, logging, status bar, summarization, rate limiting | [docs/CONFIGURATION.md](docs/CONFIGURATION.md) |
| Testing, local setup, writing skills, directory layout | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) |
| Tutorial, architecture, flows, TUI, streaming, security | [docs/README.md](docs/README.md) |

## Contributing

```bash
npm install
npm run fix        # format and lint-fix
npm run test       # verify changes
npm run coverage   # generate and verify coverage
```

The pre-commit hook runs linting, formatting, and tests; a commit fails if any gate does not pass. Conventions and workflow rules are in [AGENTS.md](AGENTS.md) and [docs/CODE_STYLE.md](docs/CODE_STYLE.md).

## License

Licensed under the [BSD-3-Clause](LICENSE) License.

Copyright (c) 2026 Jason Mulligan.
