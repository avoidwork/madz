# Getting Started with Madz

Madz is an AI harness designed to learn, adapt, and assist. You can speak to it through a terminal interface, a command-line prompt, or pipe it directly into your scripts. It does not demand ceremony. It demands clarity.

This guide walks you through deployment, configuration, and daily operation—whether you prefer the isolation of a container or the directness of a local installation. From zero to your first conversation. With precision.

---

## 📦 Preparation

Before we build, we must prepare the ground. Ensure your system meets these requirements:

### Core Requirements

- **Docker Desktop** or **Docker Engine** — the recommended deployment method
- **An LLM Provider** (API key from OpenAI, Ollama, etc.)

#### Optional

- **Git** — only if you choose to clone the repo or run without Docker
- **Node.js 24+** and **npm** — only for local installs without Docker

### What is Docker?
Docker packages your application and all its dependencies into a single, isolated container. It ensures `madz` runs identically across your machine, a server, or a cloud environment. No conflicts. No "it works on my machine."

**If you're new to Docker:** Do not worry. The commands below are straightforward. I will explain exactly what each part does.

---

## 🚀 Installation

Choose the method that best fits your workflow. There is no wrong choice, only different philosophies.

**📦 Just want to run it? (Minimal Docker Command)**
```bash
docker run -d --name madz -p 2222:22 -v ./memory:/app/memory -v ./skills:/app/skills --env-file .env avoidwork/madz:latest
```
*This pulls the image, sets up basic persistence, and starts the service. For full configuration and bind mount explanations, see below.*

### Option A: Docker (Recommended for Isolation)

**Step 1: Pull the official image**
```bash
docker pull avoidwork/madz:latest
```
*This downloads the pre-built application package from Docker Hub to your local machine.*

**Step 2: Prepare your data directories**

Bind mounts link a directory on your host machine directly into the container. This ensures your conversation history, memory files, and custom skills survive container restarts, upgrades, and removals.

**Why externalize data?** Docker containers are ephemeral by design. They can be stopped, replaced, or destroyed during updates, migrations, or troubleshooting. Any data written inside the container's filesystem is lost when the container is removed. By mounting host directories into the container, we externalize persistent state so it survives the container lifecycle. When you pull a new image or recreate the container, your memories and skills remain intact.

```bash
mkdir -p ./memory ./skills
```

**Step 3: Run the container**
```bash
docker run -d \
  --name madz \
  -p 2222:22 \
  -v ./memory:/app/memory \
  -v ./skills:/app/skills \
  --env-file .env \
  avoidwork/madz:latest
```
*Security Note: Avoid passing API keys directly via `-e` flags, as they will persist in your shell history. Instead, create a `.env` file in your project root with your variables and reference it with `--env-file .env`. For quick testing, you can still use `-e OPENAI_API_KEY="your-key"` directly, but remember to switch to `.env` for anything beyond a trial.*

**Example `.env` files:**

*OpenAI (Cloud):*
```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o
OPENAI_BASE_URL=https://api.openai.com/v1
```

*Ollama (Local):*
```env
OPENAI_BASE_URL=http://host.docker.internal:11434/v1
OPENAI_MODEL=gemma4:12b
# OPENAI_API_KEY is optional for local providers
```

*Custom model with explicit encoding:*
```env
OPENAI_BASE_URL=http://your.inference.lan:8000/v1
OPENAI_MODEL=Qwen/Qwen3-32B
OPENAI_ENCODING=qwen2_base
```

When using a non-OpenAI model, you may need to set `OPENAI_ENCODING` to specify the tiktoken encoder name that matches the model's tokenizer. See the [Encoding Reference](../README.md#encoding-reference) in the README for common mappings.

*Note for Docker users:* `host.docker.internal` is required so the container can reach the Ollama service running on your host machine. If you're on Linux, you may need to use `--network host` instead.

**Flag breakdown:**
| Flag | Purpose |
|------|---------|
| `-d` | Run in detached mode (background) |
| `--name madz` | Assign a human-readable name to the container |
| `-p 2222:22` | Map host port `2222` to container SSH port `22` (avoids conflicts with local SSH) |
| `-v ./memory:/app/memory` | Bind mount host `./memory` into container `/app/memory` for persistence |
| `-v ./skills:/app/skills` | Bind mount host `./skills` into container `/app/skills` for custom tools |
| `--env-file .env` | Inject sensitive credentials securely from a local file |

**Volumes vs. Bind Mounts:** Docker supports two persistence methods. *Volumes* are managed by Docker and live in `/var/lib/docker/volumes/`. *Bind mounts* (used here) link directly to a path on your host filesystem. We use bind mounts so you can read, edit, and version-control your memory and skills files directly from your terminal or editor.

*Port collision?* If port `2222` is already in use, change the host port in the `-p` flag (e.g., `-p 2223:22`) and update your SSH command accordingly.

### Option B: npm Global Install (System-Wide Access)

Install directly from the registry:
```bash
npm install -g @avoidwork/madz
```

Run it from anywhere:
```bash
madz
```
*This installs `madz` globally on your system. Configuration is handled via `~/.config/madz/config.yaml` or environment variables.*

**Example `config.yaml` (NPM/Local Install):**
```yaml
providers:
  openai:
    credentials:
      apiKey: "${OPENAI_API_KEY}"
    model: gpt-4o
    base_url: https://api.openai.com/v1
sandbox:
  permissions:
    - filesystem:read
    - filesystem:write
    - process:spawn
```
*Replace `apiKey`, `model`, and `base_url` as needed. For local LLMs, set `base_url` to your local endpoint and omit `apiKey` if your provider doesn't require one.*

### Option C: Clone Source Repository (Development/Customization)

For modifying the harness or contributing:
```bash
git clone https://github.com/avoidwork/madz.git
cd madz
npm install
npm start
```
*This gives you full control over the codebase. Use this if you plan to extend skills, tweak the TUI, or debug subsystems.*

---

## ⚙️ Configuration

`madz` reads its configuration from `config.yaml`. Sensitive values should be injected via environment variables to keep secrets out of version control. Secrets belong in the dark. Configuration belongs in the light.

### 🌐 LLM Providers & Sovereignty
`madz` is architecturally designed for **local AI**. While it supports cloud endpoints, its core philosophy prioritizes **data sovereignty** and **privacy**. By running models locally (e.g., Ollama, LM Studio, vLLM), you keep your conversation history, memory files, and custom skills entirely on your machine. No telemetry. No external data routing. Just pure, unfiltered compute.

For a self-hosted, local-first experience, **Ollama** ([https://ollama.com/](https://ollama.com/)) is the most straightforward path. Install it, pull a model (`ollama pull gemma4:12b`), and configure `madz` to talk to it. You will need to set `OPENAI_BASE_URL=http://localhost:11434/v1` in your `.env` file or `config.yaml`. For local providers, `OPENAI_API_KEY` is optional—many run without authentication.

Cloud providers are fully supported via the configuration below if latency or model availability dictates it, but the architecture assumes local-first by default.

### Environment Variable Mapping
Config keys map to `UPPER_SNAKE_CASE` environment variables. Container-specific keys (`providers`, `credentials`, `timeout`, `search`) are stripped from the variable name.

| Config Path | Environment Variable | Default |
|-------------|----------------------|---------|
| `providers.openai.credentials.apiKey` | `OPENAI_API_KEY` | *(required)* |
| `providers.openai.model` | `OPENAI_MODEL` | `gpt-4o` |
| `providers.openai.base_url` | `OPENAI_BASE_URL` | `https://api.openai.com/v1` |
| `providers.openai.temperature` | `OPENAI_TEMPERATURE` | `0.4` |
| `providers.openai.maxTokens` | `OPENAI_MAX_TOKENS` | `4096` |
| `providers.openai.rateLimit.requestsPerMinute` | `OPENAI_REQUESTS_PER_MINUTE` | `60` |
| `providers.openrouter.apiKey` | `OPENROUTER_API_KEY` | *(empty)* |
| `providers.openrouter.model` | `OPENROUTER_MODEL` | `openrouter/auto` |
| `providers.fal.credentials.apiKey` | `FAL_API_KEY` | *(empty)* |
| `sandbox.timeout.seconds` | `SANDBOX_TIMEOUT_SECONDS` | `30` |
| `sandbox.timeout.gracePeriod` | `SANDBOX_GRACE_PERIOD` | `5` |
| `sandbox.maxReadSize` | `SANDBOX_MAX_READ_SIZE` | `1mb` |

### Inline References (Alternative)
You can also reference environment variables directly in `config.yaml`:
```yaml
providers:
  openai:
    credentials:
      apiKey: "${OPENAI_API_KEY}"
```

---

## 🖥️ Launch & First Interaction

### Docker — Connect via SSH

If you deployed with Docker (recommended), connect to the container using the SSH port you passed to `docker run`. The container's SSH daemon listens on internal port `22`, so you map it to a host port of your choosing (commonly `2222` to avoid conflicts with your local SSH):

```bash
ssh -p 2222 madz@localhost
```

The `madz` user has no password. On login the TUI launches automatically. Press `Esc` to exit. When `madz` exits the SSH session will terminate — there is no interactive shell inside the container. The machine does not wait for idle terminals.

*First command to try: `What's the current system load?`*

### NPM — Interactive TUI

If you installed locally via npm or cloned the repo, launch the React-powered terminal interface with full conversation history, skill invocation, and runtime config mutability:

```bash
npm start
# or
node index.js --mode interactive
```

For global npm installs, just run `madz` from anywhere:

```bash
madz
```

### First Launch: The Living Profile
On your very first run, `madz` will detect that no user profile exists and initiate an **interactive onboarding flow**. It will ask a series of targeted questions to build your initial profile (e.g., *"What do you build?"*, *"What tools do you use?"*, *"How direct should I be?"*), establishing a foundation for deep, immediate personalization.

This profile is saved to `memory/context/profile.md` and injected into the system prompt at the start of every session, ensuring consistent, tailored behavior from day one.

Over time, `madz` autonomously captures **ephemeral memories** during operation. These entries log interaction patterns, decision milestones, and stylistic preferences, layering directly onto the base profile. The system prompt is dynamically rebuilt each session, ensuring consistent, context-aware behavior without manual intervention.

*To re-trigger the initial profile setup, simply delete `memory/context/profile.md` and restart.*

---

## 🛠️ Daily Usage
### TUI Navigation

Once inside the interactive terminal, use these commands:

| Command | Action |
|---------|--------|
| `↑ / ↓` | Scroll conversation history |
| `/help` | List available commands |
| `/quit` | Exit the application |
| `/provider set <name>` | Switch LLM provider |
| `/config set <path> <value>` | Mutate config at runtime |
| `/schedule list` | List all scheduled jobs |
| `/schedule pause <name>` | Pause a scheduled job |
| `/schedule resume <name>` | Resume a paused job |
| `/schedule run-now <name>` | Run a job immediately |
| `/gc` | Trigger V8 garbage collection |
| `/gc status` | Check GC availability and call count |
| `/clear` | Clear current conversation |
| `/new` | Start a fresh session |

### Memory System
`madz` operates on a **triple-layer** memory architecture:
- **Canonical Memories:** Explicitly set by you. Stored as `.md` files in `memory/context/`. Loaded into every session. Includes profile, clarifications, reflections, and temporal captures.
- **Ephemeral Memories:** Captured autonomously during operation. Record patterns, milestones, and tones. Auto-expire over time via `expiresAt` frontmatter field.
- **Reflections:** Generated daily by a cron job (`0 2 * * *`) that runs `/reflection` via `--chat` mode. Stored as canonical memories in `memory/context/` with `createdDate` and `updatedDate` metadata. The cron job is auto-installed on first onboarding completion via `setupAutoSchedule()` and persisted as `memory/schedules/reflection-daily.json`.

*This triple-layer architecture powers the autonomous learning loop — canonical memories persist, ephemeral memories capture moments, and reflections synthesize patterns into lasting context.*

Changes to canonical memory require a `/new` command to refresh the current session context.

**Context compaction:** When conversations grow too long, `madz` automatically detects context-length errors and triggers a compaction routine. A tiered retention strategy preserves high-fidelity information: the system prompt and recent exchanges are kept intact, older exchanges are summarized, and the oldest messages are dropped. This happens transparently — you never need to start a new session or manually manage context. The `compactContext` tool is always available and can also be invoked directly by the agent.

### Skills

Skills are how you give `madz` new capabilities — a bit like a macro in Excel, but with more intention. You define a set of instructions, and `madz` follows them whenever a task matches. Skills let you package domain expertise, repeatable workflows, and specialized tools that `madz` can discover and invoke on demand.

**Creating skills is natural.** Just ask `madz` in everyday language — it will generate the necessary files for you. You can also create them manually in the `skills/` directory.

Each skill is a folder containing a `SKILL.md` file with YAML frontmatter and instructions. When you ask `madz` to perform a related task, it matches your request to the skill description, loads the full instructions, and executes — optionally running any bundled scripts, loading reference documents, or applying templates.

**Directory structure:**

```
my-skill/
├── SKILL.md          # Required: metadata + instructions
├── scripts/          # Optional: executable code
├── references/       # Optional: documentation
└── assets/           # Optional: templates, resources
```

**Example SKILL.md:**

```yaml
---
name: system-info
description: Retrieve current system metrics, uptime, and memory usage. Use when the user asks about system health, load, or performance.
license: MIT
---
1. Run `uptime` and `free -h`.
2. Format the output into a concise summary.
3. Report back to the user.
```

Skills are stored in `skills/` and are version-controllable. Simple skills can be chained together into pipelines for complex multi-step processing, or composed by asking `madz` to coordinate between them.

**Built-in tools:** Beyond skills, `madz` ships with built-in tools for common tasks. The Deep Agents orchestrator (`deepAgents` library) handles multi-agent routing natively — a coding-agent for code work. The `scanAgents` tool scans for `AGENTS.md` workspace rules files. Other built-in tools include filesystem operations, terminal execution, search, memory management, and more.

---

## ⚙️ Advanced Usage

### Scheduled Jobs

`madz` supports cron-based scheduled jobs that run in non-interactive mode. Define entries in `config.yaml` to execute skills or prompts on a schedule — for example, running a skill every hour. Each invocation inherits the current session's memory context and sandbox permissions. Max-concurrency control prevents run overlap.

To schedule a task, simply ask:

```
madz, schedule the news-email skill to run during the week at 8pm
```

`madz` will parse the natural language instruction and create the cron entry for you.

### Scripting & Automation

For headless execution, pipe results directly into other tools or scripts. The `--json` flag enables structured output for automation pipelines.

```bash
node index.js "Summarize memory/_index.md" --json | jq '.content'
```

This mode is used by internal cron jobs and NPM installations.

---

## 🤖 Automating Coding Tasks with the Task Tool

`madz` can delegate complex, multi-step coding tasks to specialized subagents through the `task` tool. Instead of you orchestrating each step manually — checking git status, running lint, editing files, committing — you describe the outcome you want and a subagent handles the execution. The machine does not wait for idle terminals; it waits for clear instructions.

### Available Agent Types

Two agent types are available, each with a distinct scope:

- **`general-purpose`** — Research, file searches, multi-step tasks that span multiple domains. Has access to all tools. Use this when the task is exploratory, involves gathering information, or doesn't fit neatly into a single specialty.

- **`coding`** — Specialized for code-related work: file editing, debugging, implementation, code review, and git operations. This agent understands project conventions, follows linting standards, and respects commit message formatting rules. Use this when the task touches source code, tests, or version control.

### Concrete Examples

**Example 1: Commit and Push**

```
task coding: commit and push to this branch, we have an open pr
```

The coding-agent checks git status, stages changed files, crafts a descriptive commit message following the project's conventional commit format, and pushes to the remote branch. It will not push without explicit approval — see the notes below.

**Example 2: Run Lint, Fix Errors, Commit, and Push**

```
task coding: run lint, fix any errors, then commit and push
```

The coding-agent runs the project's lint command, identifies each issue, applies fixes to the relevant files, re-runs lint to verify all issues are resolved, and then proceeds to commit and push. If a fix is ambiguous or risky, the agent will pause and ask for guidance rather than guessing.

**Example 3: Update a PR**

```
task coding: update PR #123 with the latest changes from this branch
```

The coding-agent can interact with GitHub pull requests — updating PR descriptions, adding review comments, requesting changes, or merging. It reads the current branch state, diffs against the target branch, and composes meaningful descriptions from the actual code changes.

**Example 4: Create an Issue**

```
task coding: create an issue for memory leak in session manager
```

The coding-agent can create GitHub issues with proper titles, descriptions, labels, and categorization. It will search the codebase for relevant context, reference related files, and suggest labels based on the project's issue taxonomy.

**Example 5: Debug a Failing Test**

```
task coding: debug the failing test in tests/unit/skills.test.js and fix it
```

The coding-agent runs the specified test, analyzes the failure output, traces the root cause through the relevant source files, and applies a fix. It re-runs the test to confirm the fix resolves the issue and does not introduce regressions in related tests.

### Best Practices

- **Be specific in your delegation.** Clear, unambiguous instructions produce better results. "Fix the lint errors" is good; "run eslint on src/ and fix all errors without changing the public API" is better.
- **The coding-agent operates in the project's CWD by default.** All file paths and commands are resolved relative to the working directory.
- **It follows project conventions.** The agent reads `AGENTS.md` rules, respects the project's commit message format, and adheres to linting and formatting standards.
- **For git operations, it respects branch protection.** It will not force-push or bypass protected branches.
- **Complex tasks benefit from step-by-step instructions.** If a task has multiple phases, describe them in order and the agent will execute sequentially.

### Important Notes

- The coding-agent **never rebases** without explicit agreement.
- It **never pushes** without explicit user approval.
- It **never changes branches** without permission.
- It follows the project's **conventional commit format** for all commits.

These guardrails exist so you can delegate with confidence. The agent is a collaborator, not an autonomous actor. It acts, but it does not overreach.

---

## 🔧 Troubleshooting

### Docker-Specific
| Issue | Solution |
|-------|----------|
| `docker: command not found` | Install Docker Desktop (macOS/Windows) or Docker Engine (Linux). Verify with `docker --version`. |
| **Is the container running?** | Check status with `docker ps -a | grep madz`. If it's `Exited`, check logs with `docker logs madz`. |
| Permission denied on `docker` commands | Add your user to the `docker` group: `sudo usermod -aG docker $USER`, then restart your terminal. |
| Container exits immediately | Check logs: `docker logs madz`. Missing `OPENAI_API_KEY` or invalid config will cause early exit. |
| SSH connection refused | Ensure port mapping is correct (`-p 2222:22`). Try `ssh -o StrictHostKeyChecking=no -p 2222 madz@localhost`. |
| Memory/skills not persisting | Use volumes or bind mounts for persistent state. If using bind mounts, verify host directory permissions allow the `madz` user to read and write. |

### General
| Issue | Solution |
|-------|----------|
| **TUI not launching?** | Ensure `INK` and `React` dependencies are installed (`npm install`). |
| **Skill not executing?** | Check that the required permissions (`filesystem:read`, `filesystem:write`, etc.) are enabled in `config.yaml` under `sandbox.permissions`. |
| **Session not persisting?** | Verify that `memory/` is writable and not mounted as read-only. |
| **Need a fresh shell in Docker?** | Run `/bin/sh` after logging in, or start the app in the background with `npm start &`. |

*Deploy with confidence. The machine waits for no one, but `madz` remembers everything.*