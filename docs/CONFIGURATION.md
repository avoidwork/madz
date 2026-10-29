# Configuration

The `config.yaml` reference, logging, status bar, summarization, and rate limiting.

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
|               | `copilot.rateLimit.maxRetries`       | `6`                                      | Max retry attempts on transient errors         |
|               | `copilot.rateLimit.maxConcurrency`   | _(unset)_                                | Max concurrent requests (defaults to Infinity) |
|               | `copilot.rateLimit.maxTokensMinute`  | `0`                                      | Rolling tokens-per-minute budget; `0` disables the throttle |
| `sandbox`     | `paths`                              | `["memory/", "skills/", "tmp/"]` | Allowed filesystem paths                      |
|               | `permissions`                        | `["filesystem:read", ...]`               | Permission grants                             |
|               | `skillScanPaths`                     | `["skills/", ".skills/"]`         | Skill discovery paths (comma-separated)       |
| `memory`      | `directory`                          | `memory/`                                | Base directory for persistence                |
|               | `contextDir`                         | `memory/context/`                        | Context file directory                        |
|               | `toolsDir`                           | `memory/tools/`                          | Tool metadata directory                       |
|               | `schedulesDir`                       | `memory/schedules/`                      | Cron result files directory                   |
|               | `ephemeralLimit`                     | `5`                                      | Max concurrent ephemeral memories             |
|               | `maxEntries`                         | `100`                                    | Max memory entries                            |
|               | `maxTodos`                           | `100`                                    | Max todo items                               |
|               | `gc.enabled`                         | `true`                                   | Enable V8 garbage collection                  |
|               | `gc.idleTimeoutMs`                   | `300000`                                 | Idle timeout before GC triggers (ms)          |
|               | `gc.maxGcPerHour`                    | `4`                                      | Max GC calls per hour                         |
| `telemetry`   | `enabled`                            | `false`                                  | Enable OpenTelemetry export                   |
|               | `exporter.protocol`                  | `console`                                | Exporter protocol (`console`, `http`, `grpc`) |
|               | `exporter.endpoint`                  | `http://localhost:4318`                  | OTLP endpoint URL                             |
|               | `sampling.ratio`                     | `0.1`                                    | Trace probability                             |
| `schedules`   | `syncOnInit`                         | `true`                                   | Sync crontab from persisted job definitions   |
|               | `logPath`                            | _(empty)_                                | Cron log file path                           |
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
|               | `sampling`                           | `true`                                   | Enable the `sampling` tool (ephemeral memory capture); `false` disables registration |
| `mcp`         | `<name>.transport`                   | _(none)_                                 | MCP transport (`stdio`, `http`, `sse`)        |
|               | `<name>.command`                     | _(none)_                                 | Command for `stdio` servers                   |
|               | `<name>.args`                        | `[]`                                     | Args for `stdio` servers                      |
|               | `<name>.env`                         | _(none)_                                 | Env vars for `stdio` servers                  |
|               | `<name>.url`                         | _(none)_                                 | URL for `http`/`sse` servers                  |
|               | `<name>.agents`                      | `["orchestrator"]`                       | Agent types that receive the server's tools   |
| `persistence` | `mode`                               | `sqlite`                                 | Storage backend (`memory`, `sqlite`)          |
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

### Status Bar

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

### Summarization

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

### Rate Limiting

When `openai.rateLimit.maxTokensMinute` is set to a positive value, outgoing LLM requests are paced against a rolling 60-second token budget. Before a request is dispatched, its estimated token cost (input tokens plus the `maxTokens` output budget) is checked against the budget; if adding it would exceed the limit, the request is delayed until the window has room. Set to `0` (the default) to disable the throttle.

On a `429` rate-limit response, the request is retried once after the `retry-after` header value (in seconds or as an HTTP-date). If no `retry-after` header is present, the retry waits a default of **60 seconds**. This applies only when `maxTokensMinute` is enabled; when it is `0`, no retry occurs and the error surfaces immediately.

**Optional — Environment Variable Overrides:**

| Variable                        | Default   | Description                         |
| ------------------------------- | --------- | ----------------------------------- |
| `SKILL_AGENT_MAP_0_PATTERN`     | _(none)_  | First skill-to-agent pattern        |
| `SKILL_AGENT_MAP_0_AGENT`       | _(none)_  | First skill-to-agent mapping        |
| `SKILL_AGENT_MAP_1_PATTERN`     | _(none)_  | Second skill-to-agent pattern       |
| `SKILL_AGENT_MAP_1_AGENT`       | _(none)_  | Second skill-to-agent mapping       |
| `AGENT_SAMPLING`                | `true`    | Enable the `sampling` tool; `false` disables registration |

