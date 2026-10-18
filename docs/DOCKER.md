# Docker & Environment Variables

Building, running, and configuring the `madz` container. For a first run, see the [Quick Start](../README.md#quick-start).

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

> **Security warning:** passwordless login means anyone who can reach the published port gets a shell inside the container. Publish the port on loopback only (`-p 127.0.0.1:2222:22`) unless the host is on a trusted network or fronted by your own access controls.

Once deployed, the user connects as `madz` (no password) on the remapped port. On first login the `madz` user automatically `cd`s into `/app` and runs `npm start`. To get an interactive shell:

```bash
# Run the app in the background
npm start &

# Or start a fresh shell session
/bin/sh
```

Volume mounts (`memory/`, `skills/`) are owned by the `madz` user with group `node` for shared write access.

## Environment Variables

All configuration is controlled via environment variables in the `docker run` command. Variable names follow `UPPER_SNAKE_CASE` of the config key path (e.g., `sandbox.timeout.seconds` → `SANDBOX_TIMEOUT_SECONDS`). Container keys like `providers`, `credentials`, `timeout`, and `search` are dropped from the env var name.

`madz` supports two override patterns:

1. **Direct override** — set env vars to override `config.yaml` values, as listed below.
2. **Inline reference in `config.yaml`** — use `${VAR_NAME}` syntax in config values:

```yaml
providers:
  openai:
    credentials:
      apiKey: "${OPENAI_API_KEY}"
```

**Essential:**

| Variable         | Required | Default   | Description          |
| ---------------- | -------- | --------- | -------------------- |
| `OPENAI_API_KEY` | Cloud only | _(empty)_ | LLM provider API key (not needed for local providers) |

**Optional — Providers:**

The active provider is selected by the `enabled` flag, not by config position or `type`. **OpenAI is enabled by default** (`OPENAI_ENABLED=true`); set `COPILOT_ENABLED=true` to switch to GitHub Copilot. When multiple providers are enabled, the first one in the `providers` block wins.

| Variable                     | Default                     | Description                |
| ---------------------------- | --------------------------- | -------------------------- |
| `OPENAI_ENABLED`             | `true`                      | Enable the OpenAI provider (default) |
| `OPENAI_BASE_URL`            | `https://api.openai.com/v1` | API endpoint URL           |
| `OPENAI_MAX_CONCURRENCY`     | _(none)_                    | Max concurrent API calls   |
| `OPENAI_MAX_RETRIES`         | `6`                         | Max retries for API calls  |
| `OPENAI_MAX_TOKENS`          | `4096`                      | Max output tokens          |
| `OPENAI_MODEL`               | `gpt-4o`                    | Model name                 |
| `OPENAI_REQUESTS_PER_MINUTE` | `60`                        | Rate limit for API calls   |
| `OPENAI_TEMPERATURE`         | `0.4`                       | Sampling temperature (0–2) |
| `COPILOT_ENABLED`            | `false`                     | Enable the GitHub Copilot provider |
| `COPILOT_BASE_URL`           | `https://api.githubcopilot.com` | Copilot API endpoint URL |
| `COPILOT_MODEL`              | `gpt-4o`                    | Copilot model name         |
| `COPILOT_ENTERPRISE_URL`     | _(empty)_                   | GitHub Enterprise (GHEC) URL for Copilot |
| `OPENROUTER_API_KEY`         | _(empty)_                   | OpenRouter API key         |
| `OPENROUTER_MODEL`           | `openrouter/auto`           | OpenRouter model name      |

**Optional — Tools:**

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

**Optional — Email:**

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

**Optional — Sandbox:**

| Variable                       | Default                    | Description                                |
| ------------------------------ | -------------------------- | ------------------------------------------ |
| `SANDBOX_ENV_ALLOWLIST`        | `PATH, HOME, NODE_ENV`     | Allowed env vars (comma-separated)         |
| `SANDBOX_GRACE_PERIOD`         | `5`                        | Kill grace period in seconds               |
| `SANDBOX_MAX_READ_SIZE`        | `1mb`                      | Max file read size                         |
| `SANDBOX_MEMORY_LIMIT`         | `512m`                     | Heap limit (`--max-old-space-size`)        |
| `SANDBOX_PATHS`                | `memory/, skills/, tmp/`   | Allowed filesystem paths (comma-separated) |
| `SANDBOX_PERMISSIONS`          | _(none)_                   | Permission grants                          |
| `SANDBOX_PYTHON_IMPORT_HOOK`   | `true`                     | Prevent subprocess import                  |
| `SANDBOX_SKILL_SCAN_PATHS`     | `.skills/, skills/` | Skill scan paths (comma-separated)         |
| `SANDBOX_TIMEOUT_SECONDS`      | `30`                       | Max execution time in seconds              |
| `SANDBOX_TRUST_PROJECT_SKILLS` | `true`                     | Trust skills in project root               |
| `SANDBOX_URL_FILTER`           | `true`                     | Outbound URL blocking                      |

**Optional — Memory:**

| Variable                    | Default             | Description                    |
| --------------------------- | ------------------- | ------------------------------ |
| `MEMORY_CONTEXT_DIR`        | `memory/context/`   | Context file directory         |
| `MEMORY_DIRECTORY`          | `memory/`           | Base directory for persistence |
| `MEMORY_ERRORS_DIR`         | `memory/errors/`    | Error log directory            |
| `MEMORY_GC_ENABLED`         | `true`              | Enable V8 garbage collection   |
| `MEMORY_GC_IDLE_TIMEOUT_MS` | `300000`            | Idle timeout before GC (ms)    |
| `MEMORY_GC_MAX_GC_PER_HOUR` | `4`                 | Max GC calls per hour          |
| `MEMORY_SCHEDULES_DIR`      | `memory/schedules/` | Cron result files directory    |
| `MEMORY_TOOLS_DIR`          | `memory/tools/`     | Tool metadata directory        |

**Optional — Telemetry:**

| Variable                             | Default                 | Description                    |
| ------------------------------------ | ----------------------- | ------------------------------ |
| `TELEMETRY_ENABLED`                  | `false`                 | Enable OpenTelemetry export    |
| `TELEMETRY_EXPORTER_ENDPOINT`        | `http://localhost:4318` | OTLP endpoint URL              |
| `TELEMETRY_EXPORTER_MAX_SIZE`        | `512`                   | Batch size before flush        |
| `TELEMETRY_EXPORTER_PROTOCOL`        | `console`               | Exporter protocol              |
| `TELEMETRY_EXPORTER_SCHEDULED_DELAY` | `5000`                  | Scheduled flush interval in ms |
| `TELEMETRY_SAMPLING_RATIO`           | `0.1`                   | Trace probability              |

**Optional — Schedules:**

| Variable                   | Default     | Description                 |
| -------------------------- | ----------- | --------------------------- |
| `SCHEDULES_MAX_CONCURRENT` | `1`         | Max parallel scheduled runs |
| `SCHEDULES_MODE`           | `inprocess` | Scheduling backend          |

**Optional — TUI:**

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

**Optional — Timezone:**

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `TZ`     | `UTC`   | IANA timezone name (e.g., `America/Toronto`, `Europe/London`). The container ships with `tzdata` so any valid IANA timezone resolves. Set at runtime via `docker run -e TZ=...` or in `docker-compose.yml`. |

**Optional — Agent:**

| Variable                        | Default  | Description                                    |
| ------------------------------- | -------- | ---------------------------------------------- |
| `AGENT_RECURSION_LIMIT`         | `1000`   | Max graph execution steps per call             |
| `AGENT_AUTO_CONTINUE_LIMIT`     | `1000`   | Max consecutive auto-continue attempts before circuit breaker triggers |
| `AGENT_NODE_TIMEOUT`            | `600000` | Superstep timeout in milliseconds (default 10 minutes) |

**Optional — Persistence:**

| Variable                  | Default                 | Description              |
| ------------------------- | ----------------------- | ------------------------ |
| `PERSISTENCE_MODE`        | `memory`                | Storage backend          |
| `PERSISTENCE_SQLITE_PATH` | `memory/checkpoints.db` | SQLite checkpointer path |

**Optional — Summarization:**

| Variable                      | Default                   | Description                              |
| ----------------------------- | ------------------------- | ---------------------------------------- |
| `SUMMARIZATION_ENABLED`       | `false`                   | Enable proactive context compaction      |
| `SUMMARIZATION_TRIGGER_TYPE`  | `tokens`                  | Trigger type (`tokens`, `messages`, `fraction`) |
| `SUMMARIZATION_TRIGGER_VALUE` | `100000`                  | Trigger threshold value                  |
| `SUMMARIZATION_KEEP_TYPE`     | `messages`                | Keep type (`tokens`, `messages`, `fraction`) |
| `SUMMARIZATION_KEEP_VALUE`    | `10`                      | Messages/tokens to keep after compaction |

**Optional — Vector Search:**

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

**Alternative: inline env var references in `config.yaml`:**

Instead of passing env vars to `docker run`, reference them directly in `config.yaml`:

```yaml
providers:
  openai:
    credentials:
      apiKey: "${OPENAI_API_KEY}"
```

This is the recommended approach for container deployments — keep secrets out of `docker inspect` output.

