# Configuration Reference

Every `config.yaml` key with its default, plus logging. Environment-variable equivalents are in [DOCKER.md](./DOCKER.md#environment-variables).

## Logging

Structured JSON logging via `pino` with OS-aware directory detection. Two log files are produced:

| File                | Level       | Description                       |
| ------------------- | ----------- | --------------------------------- |
| `madz.log`          | `info`+     | All info, warn, debug, error, fatal |
| `madz_error.log`    | `error`/`fatal` | Error-level entries only    |

**Log directory by platform:**

| Platform     | Path                          | Detection                          |
| ------------ | ----------------------------- | ---------------------------------- |
| Alpine       | `~/.cache/madz/logs/`         | `/etc/alpine-release` exists       |
| Linux        | `~/.local/share/madz/logs/`   | Default (XDG)                      |
| macOS        | `~/Library/Logs/madz/`        | `process.platform === "darwin"`    |
| Windows      | `%LOCALAPPDATA%\madz\logs\`   | `process.platform === "win32"`     |

The directory is created automatically (`mkdirSync({ recursive: true })`). If the configured directory is unwritable, the logger falls back to `os.tmpdir()/madz/logs/`. If that also fails, logs are silently discarded (no crash).

During test execution (`NODE_ENV=test`), the logger operates in silent mode—no files are written.

Graceful shutdown flushes all buffered log entries to disk before process exit.

## Config Reference

| Section       | Key                                  | Default                                  | Description                                   |
| ------------- | ------------------------------------ | ---------------------------------------- | --------------------------------------------- |
| `providers`   | `openai.enabled`                     | `true`                                   | Enable the OpenAI provider (default)          |
|               | `openai.type`                        | `openai`                                 | LLM provider type                             |
|               | `openai.base_url`                    | `https://api.openai.com/v1`              | API endpoint URL                              |
|               | `openai.model`                       | `gpt-4o`                                 | Model name                                    |
|               | `openai.credentials.apiKey`          | _(empty)_                                | API key for authentication                    |
|               | `openai.temperature`                 | `0.4`                                    | Sampling temperature (0–2)                    |
|               | `openai.maxTokens`                   | `4096`                                   | Max output tokens                             |
|               | `openai.rateLimit.requestsPerMinute` | `60`                                     | Rate limit for API calls                      |
|               | `openai.rateLimit.maxRetries`       | `6`                                      | Max retry attempts on transient errors         |
|               | `openai.rateLimit.maxConcurrency`   | _(unset)_                                | Max concurrent requests (defaults to Infinity) |
|               | `openai.rateLimit.maxTokensMinute`  | `0`                                      | Rolling tokens-per-minute budget; `0` disables the throttle |
|               | `copilot.enabled`                    | `false`                                  | Enable the GitHub Copilot provider            |
|               | `copilot.type`                       | `github-copilot`                         | LLM provider type                             |
|               | `copilot.base_url`                   | `https://api.githubcopilot.com`          | Copilot API endpoint URL                      |
|               | `copilot.model`                      | `gpt-4o`                                 | Copilot model name                            |
|               | `copilot.enterpriseUrl`              | _(empty)_                                | GitHub Enterprise (GHEC) URL for Copilot      |
|               | `copilot.temperature`                | `0.4`                                    | Sampling temperature (0–2)                    |
|               | `copilot.maxTokens`                  | `4096`                                   | Max output tokens                             |
|               | `copilot.rateLimit.requestsPerMinute`| `60`                                     | Rate limit for API calls                      |
|               | `copilot.rateLimit.maxRetries`       | `6`                                      | Max retry attempts on transient errors         |
|               | `copilot.rateLimit.maxConcurrency`   | _(unset)_                                | Max concurrent requests (defaults to Infinity) |
|               | `copilot.rateLimit.maxTokensMinute`  | `0`                                      | Rolling tokens-per-minute budget; `0` disables the throttle |
| `sandbox`     | `paths`                              | `["memory/", "skills/", "tmp/"]` | Allowed filesystem paths                      |
|               | `timeout.seconds`                    | `30`                                     | _(no consumer — retained for config compat)_  |
|               | `timeout.gracePeriod`                | `5`                                      | _(no consumer — retained for config compat)_  |
|               | `memoryLimit`                        | `"512m"`                                 | _(no consumer — retained for config compat)_  |
|               | `safety.urlFilter`                   | `true`                                   | Outbound URL blocking                         |
|               | `safety.pythonImportHook`            | `true`                                   | _(no consumer — retained for config compat)_  |
|               | `env.allowlist`                      | `["PATH", "HOME", "NODE_ENV"]`           | _(no consumer — retained for config compat)_  |
|               | `permissions`                        | `["filesystem:read", ...]`               | Permission grants                             |
|               | `maxReadSize`                        | `"1mb"`                                  | Max file read size                            |
|               | `skillScanPaths`                     | `[".skills/", "skills/"]`                   | Skill discovery paths (system skills scanned first) |
|               | `trustProjectSkills`                 | `true`                                   | Trust skills in project root                  |
| `memory`      | `directory`                          | `memory/`                                | Base directory for persistence                |
|               | `contextDir`                         | `memory/context/`                        | Context file directory                        |
|               | `toolsDir`                           | `memory/tools/`                          | Tool metadata directory                       |
|               | `errorsDir`                          | `memory/errors/`                         | Error log directory                           |
|               | `schedulesDir`                       | `memory/schedules/`                      | Cron result files directory                   |
|               | `gc.enabled`                         | `true`                                   | Enable V8 garbage collection                  |
|               | `gc.idleTimeoutMs`                   | `300000`                                 | Idle timeout before GC triggers (ms)          |
|               | `gc.maxGcPerHour`                    | `4`                                      | Max GC calls per hour                         |
|               | `ephemeral.ttlDays`                  | `7`                                      | TTL for ephemeral memories in days            |
|               | `ephemeral.maxEntries`               | `10`                                     | Max concurrent ephemeral entries              |
| `telemetry`   | `enabled`                            | `false`                                  | Enable OpenTelemetry export                   |
|               | `exporter.protocol`                  | `console`                                | Exporter protocol (`console`, `http`, `grpc`) |
|               | `exporter.endpoint`                  | `http://localhost:4318`                  | OTLP endpoint URL                             |
|               | `exporter.batch.maxSize`             | `512`                                    | Batch size before flush                       |
|               | `exporter.batch.scheduledDelay`      | `5000`                                   | Scheduled flush interval in ms                |
|               | `sampling.ratio`                     | `0.1`                                    | Trace probability                             |
|               | `redact.paths`                       | `["credentials.apiKey", ...]`            | Sensitive field paths for redaction           |
| `schedules`   | `maxConcurrent`                      | `1`                                      | Max parallel scheduled runs                   |
|               | `mode`                               | `inprocess`                              | Scheduling backend (`inprocess`, `system`)    |
|               | `syncOnInit`                         | `true`                                   | Sync crontab from persisted job definitions   |
| `tui`         | `mouseScrollLines`                   | `1`                                      | Lines to scroll per mouse wheel event         |
|               | `name`                               | `madz`                                   | TUI identifier in banner                      |
|               | `showToolResults`                    | `true`                                  | Display tool call result lines in the TUI     |
|               | `reasoningCollapsed`                 | `true`                                  | Start with reasoning blocks collapsed (`ctrl+r` to toggle) |
|               | `toolCallCollapsed`                  | `true`                                  | Start with tool-call result blocks collapsed (`ctrl+t` to toggle) |
|               | `statusBar.model`                    | `true`                                  | Show the active model in the status bar       |
|               | `statusBar.skills`                   | `true`                                  | Show the skills count in the status bar       |
|               | `statusBar.messages`                 | `true`                                  | Show the message count in the status bar      |
|               | `statusBar.context`                  | `true`                                  | Show the context size in the status bar       |
|               | `statusBar.tokens`                   | `true`                                  | Show the rolling token budget in the status bar |
|               | `statusBar.quote`                    | `true`                                  | Show the rotating quote in the status bar     |
|               | `statusBar.version`                  | `true`                                  | Show the version in the status bar            |
| `agent`       | `recursionLimit`                     | `1000`                                   | Max graph execution steps per agent call      |
|               | `autoContinueLimit`                  | `1000`                                   | Max consecutive auto-continue attempts before circuit breaker triggers |
|               | `nodeTimeout`                        | `600000`                                 | Superstep timeout in milliseconds (default 10 minutes) |
| `mcp`         | `<name>.transport`                   | _(none)_                                 | MCP transport (`stdio`, `http`, `sse`)        |
|               | `<name>.command`                     | _(none)_                                 | Command for `stdio` servers                   |
|               | `<name>.args`                        | `[]`                                     | Args for `stdio` servers                      |
|               | `<name>.env`                         | _(none)_                                 | Env vars for `stdio` servers                  |
|               | `<name>.url`                         | _(none)_                                 | URL for `http`/`sse` servers                  |
|               | `<name>.agents`                      | `["orchestrator"]`                       | Agent types that receive the server's tools   |
| `lru`         | `size`                             | `100`                                    | Maximum number of cached LLM responses        |
|               | `ttl`                              | `600000`                                 | Cache entry TTL in milliseconds (10 minutes)  |
| `persistence` | `mode`                               | `memory`                                 | Storage backend (`memory`, `sqlite`)          |
|               | `sqlite_path`                        | `memory/checkpoints.db`                  | SQLite checkpointer file path                 |
| `search`      | `tavily.apiKey`                      | _(empty)_                                | Tavily search API key                        |
| `skillAgentMap` | `[].pattern`                       | _(none)_                                 | Regex pattern to match skill names            |
|               | `[].agent`                           | _(none)_                                 | Agent name to assign when pattern matches     |
| `summarization` | `enabled`                          | `false`                                  | Enable proactive context compaction           |
|               | `trigger.type`                       | `tokens`                                 | Trigger type (`tokens`, `messages`, `fraction`) |
|               | `trigger.value`                      | `100000`                                 | Trigger threshold value                       |
|               | `keep.type`                          | `messages`                               | Keep type (`tokens`, `messages`, `fraction`)  |
|               | `keep.value`                         | `10`                                     | Messages/tokens to keep after compaction      |
| `vector`      | `model`                              | `local`                                  | Embedding model (`local` or `openai`)         |
|               | `projects.<name>.rootDir`            | `.`                                      | Project root directory to scan                |
|               | `projects.<name>.dbPath`             | _(none)_                                 | Path to sqlite-vec database file              |
|               | `projects.<name>.chunkSize`          | `96`                                     | Lines per chunk                               |
|               | `projects.<name>.chunkOverlap`       | `16`                                     | Overlap between consecutive chunks            |
|               | `projects.<name>.maxFileSize`        | `524288`                                 | Max file size in bytes (500 KB)               |
|               | `projects.<name>.include`            | `["src/**/*.js", ...]`                   | Glob patterns for files to index              |
|               | `projects.<name>.exclude`            | `["node_modules/**", ...]`               | Glob patterns for files to exclude            |

## Status Bar

The `tui.statusBar` section controls which elements appear in the bottom status bar. Each element is independently gated by a boolean; the bar itself always renders, and the streaming indicator (spinner) is not configurable. All values default to `true`, so an existing config (or a bare `statusBar: {}`) resolves to today's behavior exactly.

```yaml
tui:
  statusBar:
    model: true
    skills: true
    messages: true
    context: true
    tokens: true
    quote: true
    version: true
```

- **`model`** — show the active model name (`[🧠 model]`).
- **`skills`** — show the skills count (`[⚡N]`).
- **`messages`** — show the message count (`[💬 N]`).
- **`context`** — show the context size (`[▦ N]`).
- **`tokens`** — show the rolling token budget (`[💎 count/budget]`); only renders when a budget is configured.
- **`quote`** — show the rotating quote on the right side.
- **`version`** — show the version on the right side.

Each element renders only when its boolean is `true` **and** its data is present — e.g., `tokens` also requires `openai.rateLimit.maxTokensMinute > 0`, and `quote`/`model`/`version` require a non-empty value.

## Summarization

The `summarization` section controls proactive context compaction. When `enabled` is `false` (the default), deepagents' library default applies — a 170k token trigger that keeps the last 6 messages, and compaction only happens **reactively** after a request overflows the context window. When `enabled` is `true`, madz registers a custom `SummarizationMiddleware` that fires at the configured `trigger` instead, so compaction is **proactive**.

The `trigger` and `keep` values each take a `type` of `tokens`, `messages`, or `fraction`:

```yaml
summarization:
  enabled: true
  trigger:
    type: tokens
    value: 100000
  keep:
    type: messages
    value: 10
```

- **`trigger`** — the threshold at which compaction fires. `tokens` counts input tokens, `messages` counts messages, `fraction` is a fraction of the model's max input tokens (0–1).
- **`keep`** — how much history to retain after compaction. Must be passed explicitly; deepagents defaults `keep` to 20 messages when a `trigger` is supplied without it, silently moving it from the fallback 6.

**Note:** the custom middleware reaches the **orchestrator only**. Subagents are not forked, so they keep the library default `SummarizationMiddleware`.

## Rate Limiting

When `openai.rateLimit.maxTokensMinute` is set to a positive value, outgoing LLM requests are paced against a rolling 60-second token budget. Before a request is dispatched, its estimated token cost (input tokens plus the `maxTokens` output budget) is checked against the budget; if adding it would exceed the limit, the request is delayed until the window has room. Set to `0` (the default) to disable the throttle.

On a `429` rate-limit response, the request is retried once after the `retry-after` header value (in seconds or as an HTTP-date). If no `retry-after` header is present, the retry waits a default of **60 seconds**. This applies only when `maxTokensMinute` is enabled; when it is `0`, no retry occurs and the error surfaces immediately.

**Optional — Environment Variable Overrides:**

| Variable                        | Default   | Description                         |
| ------------------------------- | --------- | ----------------------------------- |
| `SKILL_AGENT_MAP_0_PATTERN`     | _(none)_  | First skill-to-agent pattern        |
| `SKILL_AGENT_MAP_0_AGENT`       | _(none)_  | First skill-to-agent mapping        |
| `SKILL_AGENT_MAP_1_PATTERN`     | _(none)_  | Second skill-to-agent pattern       |
| `SKILL_AGENT_MAP_1_AGENT`       | _(none)_  | Second skill-to-agent mapping       |

