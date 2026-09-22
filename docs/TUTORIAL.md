# Getting Started with Madz

Madz is an AI harness designed to learn, adapt, and assist. You speak to it through a terminal interface, a one-shot command, or a pipe into your scripts. It does not demand ceremony. It demands clarity.

This guide takes you from zero to your first conversation — and then to working on *your* projects.

---

## 📦 Preparation

Before we build, we must prepare the ground. Ensure your system meets these requirements:

### Core Requirements

- **Docker Desktop** or **Docker Engine** — madz runs as a local container
- **An LLM Provider** (API key from OpenAI, or a local model via Ollama)

#### Optional

- **Node.js 24+** and **npm** — only if you intend to modify madz's own source (contributing), not to use it

### What is Docker?

Docker packages an application and all its dependencies into a single, isolated container. It ensures `madz` runs identically on your machine, day after day, without conflicts or "it works on my machine."

**If you're new to Docker:** Do not worry. The commands below are straightforward, and each part is explained.

---

## 🚀 Installation

The Docker container **is** the deployment model — for home use and professional use alike. It runs locally, with no authentication and no server. You reach it over SSH on a loopback port.

**📦 Just want to run it? (Minimal Setup)**

```bash
mkdir -p ./memory ./skills
echo 'OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxx' > .env
docker run -d --name madz -p 2222:22 -v ./memory:/app/memory -v madz-checkpoints:/app/memory/checkpoints -v ./skills:/app/skills --env-file .env avoidwork/madz:latest
docker ps   # confirm the container is Up
ssh -p 2222 madz@localhost
```

*This creates the data directories, writes your key to `.env`, starts the container, verifies it, and connects you. For full configuration and bind mount explanations, see below.*

### Option A: Docker (The Deployment Model)

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

**SQLite checkpoints:** `madz` uses an SQLite-backed checkpointer for LangGraph state persistence. The checkpoint database lives in `memory/checkpoints/checkpoints.db`. Rather than bind-mounting this subdirectory to the host, use a Docker named volume. This keeps checkpoint data managed by Docker — no host-side directory needed, and the DB survives container recreation without touching local files.

**Step 3: Run the container**
```bash
docker run -d \
  --name madz \
  -p 2222:22 \
  -v ./memory:/app/memory \
  -v madz-checkpoints:/app/memory/checkpoints \
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
| `-v madz-checkpoints:/app/memory/checkpoints` | Named volume for SQLite checkpoint data (managed by Docker, no host directory needed) |
| `-v ./skills:/app/skills` | Bind mount host `./skills` into container `/app/skills` for custom tools |
| `--env-file .env` | Inject sensitive credentials securely from a local file |

**Volumes vs. Bind Mounts:** Docker supports two persistence methods. *Volumes* are managed by Docker and live in `/var/lib/docker/volumes/`. *Bind mounts* (used here) link directly to a path on your host filesystem. We use bind mounts for `memory/` and `skills/` so you can read, edit, and version-control your memory and skills files directly from your terminal or editor. SQLite checkpoint data (`memory/checkpoints/`) uses a named volume instead — it's a binary database that doesn't need host-side editing, and Docker manages its lifecycle automatically.

*Port collision?* If port `2222` is already in use, change the host port in the `-p` flag (e.g., `-p 2223:22`) and update your SSH command accordingly.

**Verify it's alive:**
```bash
docker ps            # STATUS should read "Up"
docker logs madz     # boot log: scheduler sync, session init, TUI ready
```

### Option B: Local Install (Contributing to Madz Itself)

Nobody clones madz to *use* it — the container is the product. You only clone the source if you intend to modify the harness itself: extend skills, tweak the TUI, debug subsystems, or contribute.

```bash
git clone https://github.com/avoidwork/madz.git
cd madz
npm install
npm start
```

**Example `config.yaml` (Local Install):**
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

### Upgrading

The container is disposable; your data is not. To upgrade:

```bash
docker pull avoidwork/madz:latest
docker rm madz
docker run -d \
  --name madz \
  -p 2222:22 \
  -v ./memory:/app/memory \
  -v madz-checkpoints:/app/memory/checkpoints \
  -v ./skills:/app/skills \
  --env-file .env \
  avoidwork/madz:latest
```

Same flags, new image. Because `memory/`, `skills/`, and the checkpoint volume live outside the container, your profile, memories, sessions, and skills are exactly where you left them.

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

If you deployed with Docker (the deployment model), connect to the container using the SSH port you passed to `docker run`. The container's SSH daemon listens on internal port `22`, so you map it to a host port of your choosing (commonly `2222` to avoid conflicts with your local SSH):

```bash
ssh -p 2222 madz@localhost
```

The `madz` user has no password. On login the TUI launches automatically. Press `Esc` to exit. When `madz` exits the SSH session will terminate — there is no interactive shell inside the container.

*First command to try:* `Give me a quick system health check — CPU load, memory, and disk.`

### Local — Interactive TUI

If you installed from source (contributing), launch the React-powered terminal interface with full conversation history, skill invocation, and runtime config mutability:

```bash
npm start
# or
node index.js --mode interactive
```

### First Launch: The Living Profile
On your very first run, `madz` will detect that no user profile exists and initiate an **interactive onboarding flow**. It will ask a series of targeted questions to build your initial profile (e.g., *"What do you build?"*, *"What tools do you use?"*, *"How direct should I be?"*), establishing a foundation for deep, immediate personalization.

This profile is saved to `memory/context/profile.md` and injected into the system prompt at the start of every session, ensuring consistent, tailored behavior from day one.

Over time, `madz` autonomously captures **ephemeral memories** during operation. These entries log interaction patterns, decision milestones, and stylistic preferences, layering directly onto the base profile. The system prompt is dynamically rebuilt each session, ensuring consistent, context-aware behavior without manual intervention.

*To re-trigger the initial profile setup, simply delete `memory/context/profile.md` and restart.*

---

## 📂 Working on Your Projects

This is where madz stops being a demo and becomes a teammate. The container ships a full development toolchain — Node.js, Python, Ruby, Go, Java, Rust, Terraform, git, the GitHub CLI, and three package managers — so it can build, test, and commit real code.

**Step 1: Mount your projects directory.**

Add one bind mount to your `docker run` command, pointing at the directory on your host that holds your repositories:

```bash
docker run -d \
  --name madz \
  -p 2222:22 \
  -v ./memory:/app/memory \
  -v madz-checkpoints:/app/memory/checkpoints \
  -v ./skills:/app/skills \
  -v ~/projects:/app/projects \
  --env-file .env \
  avoidwork/madz:latest
```

Your repositories are now visible inside the container at `/app/projects/<repo>`.

**Step 2: Teach madz the convention — with a memory.**

madz's file tools resolve paths relative to the application root (`/app`). To make project work feel direct, add a canonical memory that tells the agent to treat your projects directory as the working root. The easiest way is to ask, in plain language:

```
Remember: my projects live in /app/projects. When I name a project,
treat /app/projects/<name> as the working root — resolve all file
operations, git commands, and builds relative to it.
```

madz writes this to `memory/context/`, and it is loaded into every session from then on. You can also create the file yourself:

```markdown
# Projects

My projects live in `/app/projects`. When I refer to a project by name
(e.g. "backend-api"), treat `/app/projects/backend-api` as the working
root — resolve all file operations, git commands, and builds relative to it.
```

**Step 3: Speak in direct statements.**

With the memory in place, you no longer describe paths. You describe work:

```
Fix the failing test in backend-api.
Run the build in my photo-app repo and tell me what broke.
Create a PR on backend-api for the session timeout fix.
```

The agent resolves the project name to its directory and works there — reading files, running commands, editing, committing, and pushing, all inside the mounted repo.

**Project conventions:** If a repository contains an `AGENTS.md`, the agent discovers and follows it — commit format, lint rules, branch policy. Your project's own rules take precedence over general behavior.

**Semantic code search:** For larger codebases, index a project so the agent can search it by meaning, not just by keyword:

```
Index the code in /app/projects/backend-api for vector search
```

(or run `node index.js --index-code` with the project configured under `vector.projects` in `config.yaml`).

---

## 🛠️ Daily Usage
### TUI Navigation

Once inside the interactive terminal, use these commands:

| Command | Action |
|---------|--------|
| `↑ / ↓` | Scroll conversation history |
| `/help` | List available commands |
| `/quit` | Exit the application |
| `/exit` | Exit the application |
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
| `/sessions` | Open the sessions panel |
| `/memory` | Open the memory panel |
| `/skills` | Open the skills panel |
| `/settings` | Open the settings panel |

### Memory System
`madz` operates on a **triple-layer** memory architecture:
- **Canonical Memories:** Explicitly set by you. Stored as `.md` files in `memory/context/`. Loaded into every session. Includes profile, clarifications, reflections, and temporal captures.
- **Ephemeral Memories:** Captured autonomously during operation. Record patterns, milestones, and tones. Auto-expire over time via `expiresAt` frontmatter field.
- **Reflections:** Generated daily by a cron job (`0 2 * * *`) that runs the reflection skill in chat mode. Stored as canonical memories in `memory/context/` with `createdDate` and `updatedDate` metadata. The job file is ensured at startup by the scheduler's crontab sync and persisted as `memory/schedules/reflection-daily.json`.

*This triple-layer architecture powers the autonomous learning loop — canonical memories persist, ephemeral memories capture moments, and reflections synthesize patterns into lasting context.*

Changes to canonical memory require a `/new` command to refresh the current session context.

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

**Built-in tools:** Beyond skills, `madz` ships with built-in tools for common tasks. The Deep Agents orchestrator (`deepagents` library) handles multi-agent routing natively — see [Delegating Work to Subagents](#-delegating-work-to-subagents). The `scanAgents` tool scans for `AGENTS.md` workspace rules files. Other built-in tools include filesystem operations, shell execution, search, memory management, and more.

---

## ⚙️ Advanced Usage

### Scheduled Jobs

`madz` supports cron-based scheduled jobs that run in non-interactive mode. Each invocation inherits the current session's memory context and sandbox permissions. Max-concurrency control prevents run overlap.

To schedule a task, simply ask:

```
madz, schedule the news-email skill to run during the week at 8pm
```

`madz` will parse the natural language instruction and create the cron entry for you. Manage jobs from the TUI with `/schedule list`, `/schedule pause <name>`, `/schedule resume <name>`, and `/schedule run-now <name>`.

### Scripting & Automation

For headless execution, use chat mode — the response streams to stdout, so you can pipe it into other tools:

```bash
node index.js "Summarize memory/_index.md"
```

This is the same mode the internal cron jobs use (e.g., `node index.js --message "Run the reflection skill"`). In the container, run it with `docker exec`:

```bash
docker exec madz node index.js "Summarize memory/_index.md"
```

### Virtual Filesystem

All file operations use a virtual filesystem where `/` is the application root. When you see a path like `/package.json` or `/src/tools/index.js`, the leading `/` is a virtual path that resolves relative to the application's working directory.

The orchestrator uses a `CompositeBackend` that routes file operations to different backends based on path prefix:

| Virtual Path | Backend | Actual Resolution |
|-------------|---------|-------------------|
| `/package.json` | Core Backend | `<cwd>/package.json` |
| `/src/tools/index.js` | Core Backend | `<cwd>/src/tools/index.js` |
| `/memory/context/profile.md` | Context Backend | `<cwd>/memory/context/profile.md` |

This creates a clean, consistent namespace where the agent always sees `/` as the root, regardless of where the application is actually running. Path traversal is validated — resolved paths must stay within their backend's `rootDir`.

---

## 🤖 Delegating Work to Subagents

`madz` can delegate complex, multi-step work to specialized subagents. Instead of you orchestrating each step manually — checking git status, running lint, editing files, committing — you describe the outcome you want in plain language, and the orchestrator routes the work to the right specialist.

You do not type agent names. You state the task; the orchestrator dispatches.

### Available Agent Types

| Agent | Scope |
|-------|-------|
| `coding` | Code editing, debugging, implementation, git operations |
| `search` | Multi-source search (web, docs, codebase) with synthesis |
| `debug` | Error tracing, reproduction, and fix proposals |
| `code-review` | Structured reviews: bugs, security, style, performance |
| `research` | Multi-step research with source tracking |
| `testing` | Test generation, gap analysis, coverage improvements |
| `documentation` | Documentation updates, API docs, changelogs |
| `security-audit` | Security scanning and dependency auditing |
| `performance` | Benchmarking, bottleneck identification, optimization |
| `textEditor` | Text processing — summarize, rewrite, tone, grammar |
| `seoAnalyst` | Keyword density, meta descriptions, SERP analysis |
| `translator` | Multi-language translation and language detection |

### Concrete Examples

**Commit and push:**
```
Commit and push this branch — we have an open PR.
```
The coding agent checks git status, stages changed files, crafts a commit message following the project's conventional commit format, and pushes to the remote branch. It will not push without explicit approval — see the notes below.

**Run lint, fix, commit, push:**
```
Run lint, fix any errors, then commit and push.
```
The agent runs the project's lint command, identifies each issue, applies fixes, re-runs lint to verify, and proceeds to commit and push. If a fix is ambiguous or risky, it pauses and asks for guidance rather than guessing.

**Update a PR:**
```
Update PR #123 with the latest changes from this branch.
```
The agent reads the current branch state, diffs against the target branch, and composes a meaningful description from the actual code changes.

**Create an issue:**
```
Create an issue for the memory leak in the session manager.
```
The agent searches the codebase for relevant context, references related files, and creates the issue with a proper title, description, and labels.

**Debug a failing test:**
```
Debug the failing test in tests/unit/skills.test.js and fix it.
```
The agent runs the test, analyzes the failure, traces the root cause through the relevant source files, applies a fix, and re-runs the test to confirm the fix without regressions.

### Best Practices

- **Be specific in your delegation.** Clear, unambiguous instructions produce better results. "Fix the lint errors" is good; "run lint on src/ and fix all errors without changing the public API" is better.
- **The agent operates in the project's working directory by default.** All file paths and commands are resolved relative to it.
- **It follows project conventions.** The agent reads `AGENTS.md` rules, respects the project's commit message format, and adheres to linting and formatting standards.
- **For git operations, it respects branch protection.** It will not force-push or bypass protected branches.
- **Complex tasks benefit from step-by-step instructions.** If a task has multiple phases, describe them in order and the agent will execute sequentially.

### Important Notes

- The agent **never rebases** without explicit agreement.
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
| **Is the container running?** | Check status with `docker ps -a \| grep madz`. If it's `Exited`, check logs with `docker logs madz`. |
| Permission denied on `docker` commands | Add your user to the `docker` group: `sudo usermod -aG docker $USER`, then restart your terminal. |
| Container exits immediately | Check logs: `docker logs madz`. Missing `OPENAI_API_KEY` or invalid config will cause early exit. |
| SSH connection refused | Ensure port mapping is correct (`-p 2222:22`). Try `ssh -o StrictHostKeyChecking=no -p 2222 madz@localhost`. |
| Memory/skills not persisting | Use volumes or bind mounts for persistent state. If using bind mounts, verify host directory permissions allow the `madz` user to read and write. |
| Need a shell for inspection | SSH login launches the TUI directly — there is no interactive shell. Use `docker exec -it madz /bin/sh` instead. |

### General
| Issue | Solution |
|-------|----------|
| **TUI not launching?** | Ensure `ink` and `react` dependencies are installed (`npm install`). |
| **Skill not executing?** | Check that the required permissions (`filesystem:read`, `filesystem:write`, etc.) are enabled in `config.yaml` under `sandbox.permissions`. |
| **Session not persisting?** | Verify that `memory/` is writable and not mounted as read-only. |

*Deploy with confidence. The machine waits for no one, but `madz` remembers everything.*
