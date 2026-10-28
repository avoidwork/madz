# Docker

`madz` is designed to run in a containerized environment. This provides persistent memory, container-isolated execution, and SSH access out of the box.

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

The full `docker run` command with all optional variables is in the [Environment Variables](#environment-variables) section below.

**Volume strategy:** `memory/` is bind-mounted to the host for persistent markdown storage (context, profiles, sessions). The `memory/checkpoints/` subdirectory is mounted as a separate named volume (`madz-checkpoints`) so SQLite checkpoint data lives in a Docker-managed volume rather than on the host filesystem — no host-side directory needed, and the checkpoint DB survives container recreation without touching local files.

**Skills:** The image ships with system skills in `.skills/` (e.g., the reflection skill). Project skills in `skills/` are bind-mounted by the user and are discovered at runtime. System skills shadow user skills of the same name.

## Prerequisites

- **Docker** (for the recommended containerized experience)
- **Node.js** 26 or later (optional — for local development only)
- **npm** (included with Node.js)
- An LLM provider — a cloud API key (e.g., `OPENAI_API_KEY`) or a local OpenAI-compatible server (Ollama, vLLM, LiteLLM, LM Studio)

## Building

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

## Running

Pull the prebuilt image (or [build locally](#building) for a custom image), then run:

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
  -e OPENAI_ENABLED=true \
  -e OPENAI_API_KEY="abc" \
  -e OPENAI_MODEL=Qwen/Qwen3.6-35B-A3B-FP8 \
  -e OPENAI_BASE_URL=http://your.inference.lan:8000/v1 \
  -e OPENAI_MAX_TOKENS=61440 \
  -e SEARXNG_URL=https://your.searxng.lan/search \
  avoidwork/madz:latest
```

The example above maps the container SSH port `22` to the host port `2222` to avoid conflicts with any local SSH service. Change the host port as needed (`<host_port>:22`).

## SSH Access

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

## Environment Variables

All configuration is controlled via environment variables in the `docker run` command. Variable names follow `UPPER_SNAKE_CASE` of the config key path (e.g., `sandbox.permissions` → `SANDBOX_PERMISSIONS`). Container keys like `providers`, `credentials`, and `search` are dropped from the env var name.

`madz` supports two override patterns:

1. **Direct override** — set env vars to override `config.yaml` values, as listed below.
2. **Inline reference in `config.yaml`** — use `${VAR_NAME}` syntax in config values:

```yaml
providers:
  openai:
    credentials:
      apiKey: "${OPENAI_API_KEY}"
```

### Essential

| Variable         | Required | Default   | Description          |
| ---------------- | -------- | --------- | -------------------- |
| `OPENAI_API_KEY` | Cloud only | _(empty)_ | LLM provider API key (not needed for local providers) |

### Providers

The active provider is selected by the `enabled` flag, not by config position or `type`. **OpenAI is enabled by default** (`OPENAI_ENABLED=true`); set `COPILOT_ENABLED=true` to switch to GitHub Copilot. When multiple providers are enabled, the first one in the `providers` block wins.

| Variable                     | Default                     | Description                |
| ---------------------------- | --------------------------- | -------------------------- |
| `OPENAI_ENABLED`             | `true`                      | Enable the OpenAI provider (default) |
| `OPENAI_BASE_URL`            | `https://api.openai.com/v1` | API endpoint URL           |
| `OPENAI_MAX_CONCURRENCY`     | _(none)_                    | Max concurrent API calls   |
| `OPENAI_MAX_RETRIES`         | `6`                         | Max retries for API calls  |
| `OPENAI_MAX_TOKENS`          | `4096`                      | Max output tokens          |
| `OPENAI_MODEL`               | `gpt-4o`                    | Model name                 |
| `OPENAI_TEMPERATURE`         | `0.4`                       | Sampling temperature (0–2) |
| `COPILOT_ENABLED`            | `false`                     | Enable the GitHub Copilot provider |
| `COPILOT_BASE_URL`           | `https://api.githubcopilot.com` | Copilot API endpoint URL |
| `COPILOT_MODEL`              | `gpt-4o`                    | Copilot model name         |
| `COPILOT_ENTERPRISE_URL`     | _(empty)_                   | GitHub Enterprise (GHEC) URL for Copilot |
| `AZURE_OPENAI_ENABLED`       | `false`                     | Enable the Azure OpenAI provider |
| `AZURE_OPENAI_API_KEY`       | _(empty)_                   | Azure OpenAI API key (from env, never config) |
| `AZURE_OPENAI_ENDPOINT`      | _(empty)_                   | Azure OpenAI endpoint (e.g. `https://<resource>.openai.azure.com`) |
| `AZURE_OPENAI_API_INSTANCE_NAME` | _(empty)_               | Azure OpenAI resource instance name (alternative to endpoint) |
| `AZURE_OPENAI_API_DEPLOYMENT_NAME` | _(empty)_             | Azure OpenAI deployment name (acts as the model) |
| `AZURE_OPENAI_API_VERSION`   | _(empty)_                   | Azure OpenAI API version (e.g. `2024-10-21`) |
| `OPENROUTER_API_KEY`         | _(empty)_                   | OpenRouter API key         |
| `OPENROUTER_MODEL`           | `openrouter/auto`           | OpenRouter model name      |

### Tools

| Variable                          | Default   | Description                         |
| --------------------------------- | --------- | ----------------------------------- |
| `BING_API_KEY`                    | _(empty)_ | Bing search API key                 |
| `CUSTOM_SEARCH_DESCRIPTION_FIELD` | _(empty)_ | Custom search description field     |
| `CUSTOM_SEARCH_HEADERS`           | _(empty)_ | Custom search headers (JSON string) |
| `CUSTOM_SEARCH_METHOD`            | _(empty)_ | Custom search HTTP method           |
| `CUSTOM_SEARCH_QUERY_KEY`         | _(empty)_ | Custom search query key             |
| `CUSTOM_SEARCH_TITLE_FIELD`       | _(empty)_ | Custom search title field           |
| `CUSTOM_SEARCH_URL`               | _(empty)_ | Custom search engine URL            |
| `CUSTOM_SEARCH_URL_FIELD`         | _(empty)_ | Custom search URL field             |
| `FAL_API_KEY`                     | _(empty)_ | Fal.ai API key (image generation)   |
| `SEARXNG_URL`                     | _(empty)_ | SearXNG search instance URL         |
| `TAVILY_API_KEY`                  | _(empty)_ | Tavily search API key               |

### Email

| Variable                              | Default   | Description                         |
| ------------------------------------- | --------- | ----------------------------------- |
| `EMAIL_GMAIL_ACCESS_TOKEN`            | _(empty)_ | Gmail OAuth2 access token (optional) |
| `EMAIL_GMAIL_CLIENT_ID`               | _(empty)_ | Gmail OAuth2 client ID              |
| `EMAIL_GMAIL_CLIENT_SECRET`           | _(empty)_ | Gmail OAuth2 client secret          |
| `EMAIL_GMAIL_REFRESH_TOKEN`           | _(empty)_ | Gmail OAuth2 refresh token          |
| `EMAIL_GRAPH_ACCESS_TOKEN`            | _(empty)_ | MS Graph OAuth2 access token (optional) |
| `EMAIL_GRAPH_CLIENT_ID`               | _(empty)_ | MS Graph OAuth2 client ID           |
| `EMAIL_GRAPH_CLIENT_SECRET`           | _(empty)_ | MS Graph OAuth2 client secret       |
| `EMAIL_GRAPH_REFRESH_TOKEN`           | _(empty)_ | MS Graph OAuth2 refresh token       |
| `EMAIL_GRAPH_TENANT_ID`               | _(empty)_ | MS Graph Azure AD tenant ID         |
| `EMAIL_IMAP_HOST`                     | `imap.gmail.com` | IMAP server hostname            |
| `EMAIL_IMAP_PASSWORD`                 | _(empty)_ | IMAP password / app password        |
| `EMAIL_IMAP_PORT`                     | `993`     | IMAP server port                  |
| `EMAIL_IMAP_SECURE`                   | `true`    | Use SSL/TLS for IMAP connection     |
| `EMAIL_IMAP_USER`                     | _(empty)_ | IMAP username                     |
| `EMAIL_SMTP_HOST`                     | _(same as IMAP)_ | SMTP server hostname for sending |
| `EMAIL_SMTP_PORT`                     | `587`     | SMTP server port (STARTTLS)       |

### Sandbox

| Variable                       | Default                    | Description                                |
| ------------------------------ | -------------------------- | ------------------------------------------ |
| `SANDBOX_PATHS`                | `memory/, skills/, tmp/`   | Allowed filesystem paths (comma-separated) |
| `SANDBOX_PERMISSIONS`          | _(none)_                   | Permission grants                          |
| `SANDBOX_SKILL_SCAN_PATHS`     | `.skills/, skills/` | Skill scan paths (comma-separated)         |

### Memory

| Variable                    | Default             | Description                    |
| --------------------------- | ------------------- | ------------------------------ |
| `MEMORY_CONTEXT_DIR`        | `memory/context/`   | Context file directory         |
| `MEMORY_DIRECTORY`          | `memory/`           | Base directory for persistence |
| `MEMORY_GC_ENABLED`         | `true`              | Enable V8 garbage collection   |
| `MEMORY_GC_IDLE_TIMEOUT_MS` | `300000`            | Idle timeout before GC (ms)    |
| `MEMORY_GC_MAX_GC_PER_HOUR` | `4`                 | Max GC calls per hour          |
| `MEMORY_SCHEDULES_DIR`      | `memory/schedules/` | Cron result files directory    |
| `MEMORY_TOOLS_DIR`          | `memory/tools/`     | Tool metadata directory        |

### Telemetry

| Variable                             | Default                 | Description                    |
| ------------------------------------ | ----------------------- | ------------------------------ |
| `TELEMETRY_ENABLED`                  | `false`                 | Enable OpenTelemetry export    |
| `TELEMETRY_EXPORTER_ENDPOINT`        | `http://localhost:4318` | OTLP endpoint URL              |
| `TELEMETRY_EXPORTER_PROTOCOL`        | `console`               | Exporter protocol              |
| `TELEMETRY_SAMPLING_RATIO`           | `0.1`                   | Trace probability              |

### Schedules

| Variable                   | Default     | Description                 |
| -------------------------- | ----------- | --------------------------- |
| `SCHEDULES_SYNC_ON_INIT`    | `true`      | Sync crontab from persisted job definitions |
| `SCHEDULES_LOG_PATH`        | _(empty)_   | Cron log file path           |

### TUI

| Variable                  | Default | Description                                      |
| ------------------------- | ------- | ------------------------------------------------ |
| `TUI_CURSOR_CHAR`         | `█`     | Cursor character                                 |
| `TUI_MOUSE_SCROLL_LINES`  | `1`     | Lines to scroll per mouse wheel event            |
| `TUI_NAME`                | `madz`  | TUI identifier in banner                         |
| `TUI_SHOW_TOOL_RESULTS`   | `true`  | Show tool call result lines in assistant messages |
| `TUI_REASONING_COLLAPSED` | `true`  | Start with reasoning blocks collapsed (`Ctrl+R` to toggle) |
| `TUI_TOOL_CALL_COLLAPSED` | `true`  | Start with tool-call result blocks collapsed (`Ctrl+T` to toggle) |
| `TUI_STATUS_BAR_MODEL`    | `true`  | Show the active model in the status bar          |
| `TUI_STATUS_BAR_SKILLS`   | `true`  | Show the skills count in the status bar          |
| `TUI_STATUS_BAR_MESSAGES` | `true`  | Show the message count in the status bar         |
| `TUI_STATUS_BAR_CONTEXT`  | `true`  | Show the context size in the status bar          |
| `TUI_STATUS_BAR_TOKENS`   | `true`  | Show the rolling token budget in the status bar  |
| `TUI_STATUS_BAR_QUOTE`    | `true`  | Show the rotating quote in the status bar        |
| `TUI_STATUS_BAR_VERSION`  | `true`  | Show the version in the status bar               |

### Timezone

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `TZ`     | `UTC`   | IANA timezone name (e.g., `America/Toronto`, `Europe/London`). The container ships with `tzdata` so any valid IANA timezone resolves. Set at runtime via `docker run -e TZ=...` or in `docker-compose.yml`. |

### Agent

| Variable                        | Default  | Description                                    |
| ------------------------------- | -------- | ---------------------------------------------- |
| `AGENT_RECURSION_LIMIT`         | `1000`   | Max graph execution steps per call             |

### Persistence

| Variable                  | Default                 | Description              |
| ------------------------- | ----------------------- | ------------------------ |
| `PERSISTENCE_MODE`        | `sqlite`                | Storage backend          |

### Summarization

| Variable                      | Default                   | Description                              |
| ----------------------------- | ------------------------- | ---------------------------------------- |
| `SUMMARIZATION_ENABLED`       | `false`                   | Enable proactive context compaction      |
| `SUMMARIZATION_TRIGGER_TYPE`  | `tokens`                  | Trigger type (`tokens`, `messages`, `fraction`) |
| `SUMMARIZATION_TRIGGER_VALUE` | `100000`                  | Trigger threshold value                  |
| `SUMMARIZATION_KEEP_TYPE`     | `messages`                | Keep type (`tokens`, `messages`, `fraction`) |
| `SUMMARIZATION_KEEP_VALUE`    | `10`                      | Messages/tokens to keep after compaction |

### Vector Search

| Variable                                       | Default                                       | Description                                |
| ---------------------------------------------- | --------------------------------------------- | ------------------------------------------ |
| `VECTOR_FTS_TOKENIZE`                          | `porter unicode61`                            | FTS5 tokenizer configuration               |
| `VECTOR_FULLTEXT`                              | `true`                                        | Enable FTS5 full-text indexing             |
| `VECTOR_MODEL`                                 | `local`                                       | Embedding model (`local` or `openai`)      |
| `VECTOR_PROJECTS_<NAME>_CHUNK_OVERLAP`         | `16`                                          | Overlap between consecutive chunks         |
| `VECTOR_PROJECTS_<NAME>_CHUNK_SIZE`            | `96`                                          | Lines per chunk                            |
| `VECTOR_PROJECTS_<NAME>_DB_PATH`               | _(none)_                                      | Path to sqlite-vec database file           |
| `VECTOR_PROJECTS_<NAME>_EXCLUDE_<N>`           | `node_modules/**`                             | Exclude glob pattern (indexed per entry)   |
| `VECTOR_PROJECTS_<NAME>_INCLUDE_<N>`           | `src/**/*.js`                                 | Include glob pattern (indexed per entry)   |
| `VECTOR_PROJECTS_<NAME>_MAX_FILE_SIZE`         | `524288`                                      | Max file size in bytes (500 KB)            |
| `VECTOR_PROJECTS_<NAME>_ROOT_DIR`              | `.`                                           | Project root directory to scan             |
| `VECTOR_SEARCH_MODE`                           | `hybrid`                                      | Default search mode (`vector`, `fulltext`, or `hybrid`) |

Replace `<NAME>` with the project name in `UPPER_SNAKE_CASE` (e.g., `MADZ`, `FILESIZE_JS`). For array fields like `INCLUDE` and `EXCLUDE`, append `_0`, `_1`, etc. for each entry.

### Inline references in `config.yaml`

Instead of passing env vars to `docker run`, reference them directly in `config.yaml`:

```yaml
providers:
  openai:
    credentials:
      apiKey: "${OPENAI_API_KEY}"
```

This is the recommended approach for container deployments — keep secrets out of `docker inspect` output.
