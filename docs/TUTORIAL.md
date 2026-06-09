# Getting Started with Madz

A practical guide to deploying, configuring, and running your AI harness. Whether you prefer the isolation of a container or the directness of a local Node.js installation, this tutorial will walk you through each phase. From zero to your first conversation. With precision.

---

## 🎯 What is Madz?

Madz is an AI harness designed to learn, adapt, and assist. You can speak to it through a terminal interface, a command-line prompt, or pipe it directly into your scripts. It does not demand ceremony. It demands clarity.

**Quick Test (Post-Installation):**
```bash
madz "Summarize my recent memory files and suggest a next step."
```
*Ensure the harness is running before executing. Just type, and let the machine work.*

---

## 📦 Preparation

Before we build, we must prepare the ground. Ensure your system meets these requirements:

### Core Requirements
- **Node.js 24+** (for local/npm installation)
- **Docker Desktop** or **Docker Engine** (for containerized deployment)
- **An LLM Provider API Key** (`OPENAI_API_KEY` or equivalent)
- **Git** (if cloning the source repository)

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
*Security Note: Avoid passing API keys directly via `-e` flags, as they will persist in your shell history. Instead, create a `.env` file in your project root with your variables (e.g., `OPENAI_API_KEY=sk-...`) and reference it with `--env-file .env`. For quick testing, you can still use `-e OPENAI_API_KEY="your-key"` directly, but remember to switch to `.env` for anything beyond a trial.*

**Flag breakdown:**
|| Flag | Purpose |
||------|---------|
|| `-d` | Run in detached mode (background) |
|| `--name madz` | Assign a human-readable name to the container |
|| `-p 2222:22` | Map host port `2222` to container SSH port `22` (avoids conflicts with local SSH) |
|| `-v ./memory:/app/memory` | Bind mount host `./memory` into container `/app/memory` for persistence |
|| `-v ./skills:/app/skills` | Bind mount host `./skills` into container `/app/skills` for custom tools |
|| `--env-file .env` | Inject sensitive credentials securely from a local file |

**Volumes vs. Bind Mounts:** Docker supports two persistence methods. *Volumes* are managed by Docker and live in `/var/lib/docker/volumes/`. *Bind mounts* (used here) link directly to a path on your host filesystem. We use bind mounts so you can read, edit, and version-control your memory and skills files directly from your terminal or editor.

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

Cloud providers are fully supported via the configuration below if latency or model availability dictates it, but the architecture assumes local-first by default.

### Environment Variable Mapping
Config keys map to `UPPER_SNAKE_CASE` environment variables. Container-specific keys (`providers`, `credentials`, `timeout`, `search`) are stripped from the variable name.

|| Config Path | Environment Variable | Default |
||-------------|----------------------|---------|
|| `providers.openai.credentials.apiKey` | `OPENAI_API_KEY` | *(required)* |
|| `providers.openai.model` | `OPENAI_MODEL` | `gpt-4o` |
|| `providers.openai.base_url` | `OPENAI_BASE_URL` | `https://api.openai.com/v1` |
|| `providers.openai.temperature` | `OPENAI_TEMPERATURE` | `0.7` |
|| `providers.openai.maxTokens` | `OPENAI_MAX_TOKENS` | `4096` |
|| `providers.openai.rateLimit.requestsPerMinute` | `OPENAI_REQUESTS_PER_MINUTE` | `120` |
|| `providers.openrouter.apiKey` | `OPENROUTER_API_KEY` | *(empty)* |
|| `providers.openrouter.model` | `OPENROUTER_MODEL` | `openrouter/auto` |
|| `sandbox.timeout.seconds` | `SANDBOX_TIMEOUT_SECONDS` | `30` |
|| `sandbox.timeout.gracePeriod` | `SANDBOX_GRACE_PERIOD` | `5` |
|| `sandbox.maxReadSize` | `SANDBOX_MAX_READ_SIZE` | `1mb` |

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

The `madz` user has no password. On first login the TUI launches automatically. Press `Esc` to exit. When `madz` exits the SSH session will terminate — there is no interactive shell inside the container. The machine does not wait for idle terminals.

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

|| Command | Action |
||---------|--------|
|| `↑ / ↓` | Scroll conversation history |
|| `:help` | List available commands |
|| `:config set <key> <value>` | Mutate config at runtime |
|| `:skill <name>` | Invoke a discovered skill |
|| `:schedule pause` / `resume` | Control the cron scheduler |
|| `:clear` | Clear current conversation |
|| `:new` | Start a fresh session |

### Standalone Execution

Execute a single prompt and return the result.

```bash
node index.js "What's the current system load?"
```

Pipe results directly into other tools or scripts. The `--json` flag enables structured output for scripting.

```bash
node index.js "Summarize memory/_index.md" --json
```

### Memory System
`madz` operates on a dual-layer memory architecture:
- **Canonical Memories:** Explicitly set by you. Stored as `.md` files in `memory/context/`. Loaded into every session.
- **Ephemeral Memories:** Captured autonomously during operation. Record patterns, milestones, and tones. Auto-expire over time.

*This dual-layer architecture is exactly what powers the "ephemeral memories" mentioned during First Launch, allowing Madz to learn, adapt, and refine your experience over time.*

Changes to canonical memory require a `:new` command to refresh the current session context.

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

---

## ⚙️ Advanced Usage

### CLI Mode

Execute a single prompt and return the result. This mode is used by internal cron jobs and NPM installations.

```bash
node index.js "What's the current system load?"
```

### Scheduled Jobs

`madz` supports cron-based scheduled jobs that run in non-interactive mode. Define entries in `config.yaml` to execute skills or prompts on a schedule — for example, running a skill every hour. Each invocation inherits the current session's memory context and sandbox permissions. Max-concurrency control prevents run overlap.

To schedule a task, simply ask:

```
madz, schedule the news-email skill to run during the week at 8pm
```

`madz` will parse the natural language instruction and create the cron entry for you.

### Pipeline / JSON Output

Pipe results directly into other tools or scripts. The `--json` flag enables structured output for scripting.

```bash
node index.js "Summarize memory/_index.md" --json
```

---

## 🔧 Troubleshooting

### Docker-Specific
|| Issue | Solution |
||-------|----------|
|| `docker: command not found` | Install Docker Desktop (macOS/Windows) or Docker Engine (Linux). Verify with `docker --version`. |
|| **Is the container running?** | Check status with `docker ps -a | grep madz`. If it's `Exited`, check logs with `docker logs madz`. |
|| Permission denied on `docker` commands | Add your user to the `docker` group: `sudo usermod -aG docker $USER`, then restart your terminal. |
|| Container exits immediately | Check logs: `docker logs madz`. Missing `OPENAI_API_KEY` or invalid config will cause early exit. |
|| SSH connection refused | Ensure port mapping is correct (`-p 2222:22`). Try `ssh -o StrictHostKeyChecking=no -p 2222 madz@localhost`. |
|| Memory/skills not persisting | Verify volume paths exist on the host before running: `mkdir -p ./memory ./skills`. |

### General
- **TUI not launching?** Ensure `INK` and `React` dependencies are installed (`npm install`).
- **Skill not executing?** Check that the required permissions (`filesystem:read`, `filesystem:write`, etc.) are enabled in `config.yaml` under `sandbox.permissions`.
- **Session not persisting?** Verify that `memory/` is writable and not mounted as read-only.
- **Need a fresh shell in Docker?** Run `/bin/sh` after logging in, or start the app in the background with `npm start &`.

*Deploy with confidence. The machine waits for no one, but `madz` remembers everything.*