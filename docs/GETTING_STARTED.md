# Getting Started: Configuration

This guide walks you through the configuration decisions that turn `madz` from a running container into a working teammate. It assumes you have Docker and an LLM provider — the practical install steps live in [TUTORIAL.md](./TUTORIAL.md). Here we focus on *what to configure* and *why*.

The four decisions, in the order you'll likely make them:

1. **Pick your LLM provider** — any OpenAI-compatible endpoint.
2. **Enable a decision model** — a fast local classifier for the harness's own routing.
3. **Set project context** — tell madz *where* you're working.
4. **Enable vector search** *(advanced)* — let madz find code by meaning.

---

## 1. Pick Your LLM Provider

madz talks to its model through the **OpenAI chat-completions API**. That means it works with *any* provider that exposes that interface — not just OpenAI itself. The most common choices:

| Provider | Notes |
|----------|-------|
| **Ollama** | The most straightforward local path. Install it, pull a model, point `OPENAI_BASE_URL` at it. |
| **vLLM** | High-throughput self-hosted inference, OpenAI-compatible out of the box. |
| **LiteLLM** | A proxy that fronts many backends behind a single OpenAI-compatible endpoint. |
| **LM Studio**, **llama.cpp** | Any other OpenAI-compatible server. |
| **OpenAI** (cloud) | The default. Requires an API key. |

You point madz at one by setting three variables in your `.env`:

| Variable | Purpose |
|----------|---------|
| `OPENAI_BASE_URL` | The API endpoint. |
| `OPENAI_MODEL` | The model name. |
| `OPENAI_API_KEY` | Optional for local providers — many run without authentication. |

### Example `.env` files

*Ollama (local):*
```env
OPENAI_BASE_URL=http://host.docker.internal:11434/v1
OPENAI_MODEL=gemma4:12b
# OPENAI_API_KEY is optional for local providers
```

*vLLM (self-hosted):*
```env
OPENAI_BASE_URL=http://your.inference.lan:8000/v1
OPENAI_MODEL=Qwen/Qwen3-32B
```

*OpenAI (cloud):*
```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o
OPENAI_BASE_URL=https://api.openai.com/v1
```

### Docker networking gotcha

When madz runs in a container and your model runs on the host, the container needs a way to reach it. Use `host.docker.internal` as the hostname:

```env
OPENAI_BASE_URL=http://host.docker.internal:11434/v1
```

On Linux, `host.docker.internal` may not resolve — use `--network host` instead.

> **Reference:** [TUTORIAL.md](./TUTORIAL.md) §Configuration, [FEATURES.md](./FEATURES.md) §LLM Provider Abstraction, [CONFIGURATION.md](./CONFIGURATION.md) §Config Reference.

---

## 2. Enable a Decision Model

The `decision` tool wraps Ollama's `/v1/systemone` endpoint for fast, structured classification — routing a task, checking a request against a policy, or scoring against a rubric. It is **not** an agentic loop: it returns structured answers from a single request, which is why it's exposed as a tool rather than a subagent.

This is optional. An unconfigured install is unaffected — the tool simply isn't registered.

### Configuration

```yaml
agent:
  decision:
    baseUrl: ""            # empty = tool not registered
    model: tev1:4b
```

- **`baseUrl`** is the activation switch. Set it to your local Ollama instance (e.g. `http://localhost:11434`) to enable the tool.
- **`model`** defaults to `tev1:4b`.

### Prerequisites

- **Ollama 0.35+**
- Pull the model:
  ```bash
  ollama pull tev1:4b      # 4.5GB, 256K context
  ollama pull tev1:0.8b    # 812MB
  ```

### Question types

| Type | Answer fields |
|------|---------------|
| `choice` | `choice`, `probabilities`, `confidence` |
| `noul` | `noul`, the probability the answer is true |
| `score` | `score` (probability-weighted level), `legend`, `probabilities`, `confidence` |

### Practical caveats

- Use `/v1/systemone`, **not** the regular chat endpoint — in a regular chat, tev1 tends to reply in prose.
- Keep inputs short. Every question is scored with the full state and question set in its prompt, and tev1 runs at ~2,000 tokens context.
- `choice` and `score` questions take 2–26 options. Add a `none` option if none of your options might fit.
- Request bodies are limited to 64 KiB.
- It can be wrong — don't let it be the only check on a high-stakes decision.

> **Reference:** [FEATURES.md](./FEATURES.md) §Decisioning Models.

---

## 3. Set Project Context

madz needs to know *where* you're working. Two things make this work: a mount, and a convention.

### Mount your projects

Add a bind mount pointing at the directory on your host that holds your repositories:

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

### The convention is built in

You don't need to configure anything for this to work. The system prompt carries a standing directive:

> **Project directories are cwd.** Each immediate subdirectory of `projects/` is a standalone project root. When the user works on one, treat that subdirectory as the working directory for the task — resolve relative paths against it, run commands with it as the working directory, and apply its own project rules (`AGENTS.md`, config, lint) instead of the parent's.

So naming a project is enough. The agent resolves the name to its directory and works there.

### Pin the active project with `/projects`

The convention lets the agent resolve a project by name. But sometimes you want to *pin* the working directory — so the file picker and the agent's file operations both target a specific project:

```
/projects
```

This opens the projects panel, listing every directory under `projects/`. Navigate with `↑/↓`, press Enter to select one, and it becomes the **active project**. The status bar shows the selected project's name (e.g. `[backend-api]`), and the `@` file picker now globs that project's directory instead of the container root.

Once a project is active, the `@` file picker lists files from inside it:

```
read @src/config/loader.js
```

To return to the default working directory (the container root), clear it:

```
/projects clear
```

Or select `(clear active project)` at the top of the projects panel.

The active project is shown in the status bar and can be toggled via the `statusBar.project` config option.

> **Reference:** [TUTORIAL.md](./TUTORIAL.md) §Working on Your Projects, [FEATURES.md](./FEATURES.md) §Active Project.

---

## 4. Vector Search for Projects *(advanced)*

Vector search lets madz find code by **meaning** rather than exact keyword matches — useful for debugging, refactoring, and feature implementation across a large codebase. This is an advanced configuration; skip it until you're comfortable with the basics.

### Configure a project

Each named project under `vector.projects` defines its own root directory, database path, and indexing rules. In `config.yaml`:

```yaml
vector:
  model: local                    # "local" or "openai" — shared across all projects
  projects:
    backendapi:
      rootDir: /app/projects/backend-api
      dbPath: /app/projects/backend-api/vector.db
      chunkSize: 96               # Lines per chunk
      chunkOverlap: 16            # Overlap between consecutive chunks
      maxFileSize: 524288         # Max file size in bytes (500 KB)
      include:
        - "src/**/*.js"
        - "src/**/*.mjs"
        - "src/**/*.cjs"
      exclude:
        - "node_modules/**"
        - ".git/**"
```

You can also configure a project via environment variables — the project name is the first segment, lowercased, so keep it a single word:

```env
VECTOR_PROJECTS_BACKENDAPI_ROOT_DIR=/app/projects/backend-api
VECTOR_PROJECTS_BACKENDAPI_DB_PATH=/app/projects/backend-api/vector.db
```

(`include` defaults to `src/**/*.js`, `src/**/*.mjs`, `src/**/*.cjs`. Array fields are indexed from `_0`, so `VECTOR_PROJECTS_BACKENDAPI_INCLUDE_0=src/**/*.ts` replaces the first include pattern. `.env` is injected at container start, so after adding these lines, recreate the container with the same `docker run` flags.)

### Index, then search

Indexing and search are two halves of one workflow. **You must index before you can search.**

1. **Index** — run `indexCode` after adding code or changing project config, so the vector store reflects the current source tree:
   ```
   indexCode()                # Index all configured projects
   indexCode(project="backendapi")  # Index a single project
   indexCode(force=true)      # Force re-index all files
   ```
2. **Search** — run `searchCode` to find code by meaning. Re-index when the code changes:
   ```
   searchCode(query="authentication flow", project="backendapi")
   searchCode(query="tool registration pattern", mode="vector")    # pure semantic
   searchCode(query="tool registration pattern", mode="fulltext")  # exact keyword
   ```

### Advanced knobs

- **`model`** — `local` (default) uses `Xenova/all-MiniLM-L6-v2` via transformers.js (~23 MB, downloaded on first use); `openai` uses `text-embedding-3-small` and requires `OPENAI_API_KEY`.
- **`chunkSize` / `chunkOverlap`** — how source files are split into line blocks.
- **`include` / `exclude`** — glob patterns for which files to index.

> **Reference:** [VECTOR_SEARCH.md](./VECTOR_SEARCH.md) (full reference), [TUTORIAL.md](./TUTORIAL.md) §Semantic code search.

---

## Verify It's Alive

A short checklist after configuration:

- [ ] Container is up: `docker ps` shows `Up`.
- [ ] First conversation works: `ssh -p 2222 madz@localhost`, then send a message.
- [ ] `/projects` lists your mounted repositories.
- [ ] If you configured vector search: `searchCode` returns results, not a "Try running the indexCode tool first" hint.

---

*Configuration belongs in the light. Secrets belong in the dark.*
