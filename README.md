# Madz

**A security-first, self-contained autonomous coding agent — with a cinematic soul.** | [denkerne.ai](https://denkerne.ai)

[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-blue.svg)](LICENSE)
[![Node.js >= 24](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](docs/DEVELOPMENT.md#testing)

`madz` is a fully self-contained development environment wrapped around an autonomous coding agent. It ships with a complete toolchain — Node.js, Python, Ruby, Go, Java, Rust, Terraform, Chromium, and more — plus a Deep Agents orchestrator, a sandboxed skill runtime, persistent memory, and a terminal UI. It's the whole package: a container you run, an agent you reach over SSH, and a teammate you trust to do real work in environments where auditability and containment matter.

More than a tool, it's a **digital teammate** — one that remembers your context, adapts to how you work, and speaks with the calm, measured precision of Mads Mikkelsen's most iconic roles. It doesn't just execute; it engages. It has a personality, a memory, and a point of view — and it brings all three to the work.

Everything is persisted as version-controllable Markdown files, so the entire state of the system — memory, context, sessions, schedules — is auditable with `git log` and re-loadable across sessions. Built on LangGraph, OpenTelemetry, and Ink, with persistent memory, sandboxed tool execution, cron scheduling, and a React-powered TUI.

## The Personality

`madz` isn't a blank slate. It's built on a persona — the cinematic soul of Mads Mikkelsen — and that persona shapes how it works with you. It's not decoration; it's the difference between a tool that answers and a teammate that engages.

| Character | Source | When it shows up |
|-----------|--------|------------------|
| **Hannibal Lecter** | *Hannibal* (2013–2015) | Code review, security audit, architectural critique, critical analysis |
| **Le Chiffre** | *Casino Royale* (2006) | Debugging, tracing, mathematical problems, error analysis |
| **Galen Erso** | *Rogue One* (2016) | Building, fixing, designing systems, scaffolding |
| **Martin** | *Another Round* (2020) | Brainstorming, exploring, when you're stuck, creative problem-solving |
| **Claus** | *Polar* (2019) | Calm decisiveness under pressure, incident response, high-stakes decisions |

The default is **Hannibal** — the one it returns to. The others are situational, selected by the task at hand. It speaks with a measured cadence, dry humor, and a genuine point of view. It remembers your context and adapts to your energy. It treats you with intense respect and quiet competence.

This is what makes `madz` feel like a teammate rather than a tool — and it's a differentiator you won't find in a generic agent.

## Why Madz

Most coding agents are a thin layer over a model. `madz` is the opposite — it is a **complete development environment** with an agent at its center. That distinction is the whole point.

- **Self-contained.** The container ships a full toolchain: Node.js 26 (the minimum supported is 24), Python 3, Ruby, Go, Java (OpenJDK 21), Rust, Terraform, tflint, Chromium, ripgrep, git, the GitHub CLI, and three package managers (npm, yarn, pnpm). It is a working dev box, not a chat window. You can SSH into it and do real work.
- **A teammate, not a tool.** `madz` channels the cinematic soul of Mads Mikkelsen — see [The Personality](#the-personality). It works *with* you rather than at you, and that's what makes long sessions feel collaborative instead of transactional.
- **Security-first.** Filesystem access is confined to an allowlist/denylist of paths, and outbound URLs are filtered by scheme and hostname — blocked schemes include `file://`, `gopher://`, and `dict://`. Built-in tools are gated by explicit permissions, and skill metadata is schema-validated before it is registered. This is layered containment by design — not a promise that the agent is harmless, but a set of constraints that narrow what any single tool can reach.
- **Autonomous.** A Deep Agents orchestrator routes work to a family of specialized subagents — code review, coding, debugging, security auditing, testing, performance, research, and more. It can read your codebase, find bugs, write fixes, run tests, and open PRs without you driving every step.
- **Auditable.** The entire system state is Markdown. Memory, context, sessions, schedules, and skill definitions are all plain files under version control. `git log` is your audit trail — essential for regulated environments where you must prove what happened and why.
- **Local-first.** Data stays in your environment. Nothing leaves the container unless you explicitly configure it to. Secrets are loaded only from environment variables and never logged or hardcoded.

## Use Cases

`madz` is built for environments where you need an agent that can be trusted with real work and held accountable for it.

- **Enterprise development.** A self-contained dev environment with a full toolchain, semantic code search, and an orchestrator that can implement, test, and ship features. Spin up one `madz` per project and you've got a dedicated teammate with its own context and memory.
- **Security operations.** Path allowlists, URL scheme/hostname filtering, permission-gated tools, a dedicated `security-audit` subagent, dependency auditing, and a documented threat model. Run audits in an isolated container without exposing your host.
- **Regulated & high-assurance environments.** Medical, financial, and government contexts where auditability, deterministic behavior, and data sovereignty are non-negotiable. Because every action is a version-controlled Markdown file, you can demonstrate exactly what the agent did and why.
- **Personal automation.** A persistent teammate that remembers your context, runs your skills on a schedule, and automates the mundane — with the calm precision of a well-built tool and the dry wit of someone who's been at this a while.

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
│  │ Sandboxed │   │ LLM        │   │ Built-in     │            │
│  │ skills    │   │ provider   │   │ tools (30+)  │            │
│  │ (isolated │   │ (OpenAI-   │   │ + deepagents │            │
│  │  process) │   │  compat)   │   │  filesystem) │            │
│  └───────────┘   └────────────┘   └──────────────┘            │
│                                                               │
│  Memory (Markdown) · Vector search (sqlite-vec) · Cron        │
└───────────────────────────────────────────────────────────────┘
```

The orchestrator routes tasks to specialized subagents, each with a focused system prompt and a curated tool set. Tools are gated by permissions and sandbox path/URL constraints. Skills are `SKILL.md` instruction files interpreted by the agent through the Deep Agents skill system. Everything is persisted as Markdown and indexed for semantic search.

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
