# Configuration

The `config.yaml` reference, logging, status bar, summarization, and rate limiting.

## Logging

Structured JSON logging via `pino` with OS-aware directory detection. Two log files are produced:

| File             | Level           | Description                         |
| ---------------- | --------------- | ----------------------------------- |
| `madz.log`       | `info`+         | All info, warn, debug, error, fatal |
| `madz_error.log` | `error`/`fatal` | Error-level entries only            |

**Log directory by platform:**

| Platform | Path                        | Detection                       |
| -------- | --------------------------- | ------------------------------- |
| Alpine   | `~/.cache/madz/logs/`       | `/etc/alpine-release` exists    |
| Linux    | `~/.local/share/madz/logs/` | Default (XDG)                   |
| macOS    | `~/Library/Logs/madz/`      | `process.platform === "darwin"` |
| Windows  | `%LOCALAPPDATA%\madz\logs\` | `process.platform === "win32"`  |

The directory is created automatically (`mkdirSync({ recursive: true })`). If the configured directory is unwritable, the logger falls back to `os.tmpdir()/madz/logs/`. If that also fails, logs are silently discarded (no crash).

During test execution (`NODE_ENV=test`), the logger operates in silent mode—no files are written.

Graceful shutdown flushes all buffered log entries to disk before process exit.

## Config Reference

| Section         | Key                                 | Default                          | Description                                                                                                                                                 |
| --------------- | ----------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `providers`     | `openai.enabled`                    | `true`                           | Enable the OpenAI provider (default)                                                                                                                        |
|                 | `openai.type`                       | `openai`                         | LLM provider type                                                                                                                                           |
|                 | `openai.base_url`                   | `https://api.openai.com/v1`      | API endpoint URL                                                                                                                                            |
|                 | `openai.model`                      | `gpt-4o`                         | Model name                                                                                                                                                  |
|                 | `openai.credentials.apiKey`         | _(empty)_                        | API key for authentication                                                                                                                                  |
|                 | `openai.temperature`                | `0.4`                            | Sampling temperature (0–2)                                                                                                                                  |
|                 | `openai.maxTokens`                  | `4096`                           | Max output tokens                                                                                                                                           |
|                 | `openai.rateLimit.maxRetries`       | `6`                              | Max retry attempts on transient errors                                                                                                                      |
|                 | `openai.rateLimit.maxConcurrency`   | _(unset)_                        | Max concurrent requests (defaults to Infinity)                                                                                                              |
|                 | `openai.rateLimit.maxTokensMinute`  | `0`                              | Rolling tokens-per-minute budget; `0` disables the throttle                                                                                                 |
|                 | `copilot.enabled`                   | `false`                          | Enable the GitHub Copilot provider                                                                                                                          |
|                 | `copilot.type`                      | `github-copilot`                 | LLM provider type                                                                                                                                           |
|                 | `copilot.base_url`                  | `https://api.githubcopilot.com`  | Copilot API endpoint URL                                                                                                                                    |
|                 | `copilot.model`                     | `gpt-4o`                         | Copilot model name                                                                                                                                          |
|                 | `copilot.enterpriseUrl`             | _(empty)_                        | GitHub Enterprise (GHEC) URL for Copilot                                                                                                                    |
|                 | `copilot.temperature`               | `0.4`                            | Sampling temperature (0–2)                                                                                                                                  |
|                 | `copilot.maxTokens`                 | `4096`                           | Max output tokens                                                                                                                                           |
|                 | `copilot.rateLimit.maxRetries`      | `6`                              | Max retry attempts on transient errors                                                                                                                      |
|                 | `copilot.rateLimit.maxConcurrency`  | _(unset)_                        | Max concurrent requests (defaults to Infinity)                                                                                                              |
|                 | `copilot.rateLimit.maxTokensMinute` | `0`                              | Rolling tokens-per-minute budget; `0` disables the throttle                                                                                                 |
| `sandbox`       | `paths`                             | `["memory/", "skills/", "tmp/"]` | Allowed filesystem paths                                                                                                                                    |
|                 | `permissions`                       | `["filesystem:read", ...]`       | Permission grants                                                                                                                                           |
|                 | `skillScanPaths`                    | `["skills/", ".skills/"]`        | Skill discovery paths (comma-separated)                                                                                                                     |
| `api`           | `allowlist`                         | `[]`                             | Hosts the `api` tool may reach (exact host, `*.wildcard`, `host:port`, or origin URL). Empty allows any host; internal addresses are not blocked by default |
|                 | `rateLimit`                         | `10`                             | Max `api` requests per second, per host; `0` disables                                                                                                       |
|                 | `maxRedirects`                      | `5`                              | Max redirects followed; each hop is re-validated; `0` returns 3xx responses as-is                                                                           |
|                 | `maxRetries`                        | `2`                              | Retries on 429/502/503/504 and transient network errors (non-idempotent methods retry 429 only)                                                             |
|                 | `credentials`                       | `{}`                             | Named credential profiles (see below)                                                                                                                       |
| `memory`        | `directory`                         | `memory/`                        | Base directory for persistence                                                                                                                              |
|                 | `contextDir`                        | `memory/context/`                | Context file directory                                                                                                                                      |
|                 | `toolsDir`                          | `memory/tools/`                  | Tool metadata directory                                                                                                                                     |
|                 | `schedulesDir`                      | `memory/schedules/`              | Cron result files directory                                                                                                                                 |
|                 | `ephemeralLimit`                    | `5`                              | Max concurrent ephemeral memories                                                                                                                           |
|                 | `maxEntries`                        | `100`                            | Max memory entries                                                                                                                                          |
|                 | `maxTodos`                          | `100`                            | Max todo items                                                                                                                                              |
|                 | `gc.enabled`                        | `true`                           | Enable V8 garbage collection                                                                                                                                |
|                 | `gc.idleTimeoutMs`                  | `300000`                         | Idle timeout before GC triggers (ms)                                                                                                                        |
|                 | `gc.maxGcPerHour`                   | `4`                              | Max GC calls per hour                                                                                                                                       |
| `telemetry`     | `enabled`                           | `false`                          | Enable OpenTelemetry export                                                                                                                                 |
|                 | `exporter.protocol`                 | `console`                        | Exporter protocol (`console`, `http`, `grpc`)                                                                                                               |
|                 | `exporter.endpoint`                 | `http://localhost:4318`          | OTLP endpoint URL                                                                                                                                           |
|                 | `sampling.ratio`                    | `0.1`                            | Trace probability                                                                                                                                           |
| `schedules`     | `syncOnInit`                        | `true`                           | Sync crontab from persisted job definitions                                                                                                                 |
|                 | `logPath`                           | _(empty)_                        | Cron log file path                                                                                                                                          |
| `tui`           | `mouseScrollLines`                  | `1`                              | Lines to scroll per mouse wheel event                                                                                                                       |
|                 | `name`                              | `madz`                           | TUI identifier in banner                                                                                                                                    |
|                 | `showToolResults`                   | `true`                           | Display tool call result lines in the TUI                                                                                                                   |
|                 | `reasoningCollapsed`                | `true`                           | Start with reasoning blocks collapsed (`ctrl+r` to toggle)                                                                                                  |
|                 | `toolCallCollapsed`                 | `true`                           | Start with tool-call result blocks collapsed (`ctrl+t` to toggle)                                                                                           |
|                 | `statusBar.model`                   | `true`                           | Show the active model in the status bar                                                                                                                     |
|                 | `statusBar.skills`                  | `true`                           | Show the skills count in the status bar                                                                                                                     |
|                 | `statusBar.messages`                | `true`                           | Show the message count in the status bar                                                                                                                    |
|                 | `statusBar.context`                 | `true`                           | Show the context size in the status bar                                                                                                                     |
|                 | `statusBar.tokens`                  | `true`                           | Show the rolling token budget in the status bar                                                                                                             |
|                 | `statusBar.quote`                   | `true`                           | Show the rotating quote in the status bar                                                                                                                   |
|                 | `statusBar.version`                 | `true`                           | Show the version in the status bar                                                                                                                          |
| `agent`         | `recursionLimit`                    | `1000`                           | Max graph execution steps per agent call                                                                                                                    |
|                 | `sampling`                          | `true`                           | Enable the `sampling` tool (ephemeral memory capture); `false` disables registration                                                                        |
|                 | `bundledSkills`                     | `true`                           | Load bundled `.skills/` skills; `false` loads only `reflection` from `.skills/`                                                                             |
| `mcp`           | `<name>.transport`                  | _(none)_                         | MCP transport (`stdio`, `http`, `sse`)                                                                                                                      |
|                 | `<name>.command`                    | _(none)_                         | Command for `stdio` servers                                                                                                                                 |
|                 | `<name>.args`                       | `[]`                             | Args for `stdio` servers                                                                                                                                    |
|                 | `<name>.env`                        | _(none)_                         | Env vars for `stdio` servers                                                                                                                                |
|                 | `<name>.url`                        | _(none)_                         | URL for `http`/`sse` servers                                                                                                                                |
|                 | `<name>.agents`                     | `["orchestrator"]`               | Agent types that receive the server's tools                                                                                                                 |
| `persistence`   | `mode`                              | `sqlite`                         | Storage backend (`memory`, `sqlite`)                                                                                                                        |
| `search`        | `tavily.apiKey`                     | _(empty)_                        | Tavily search API key                                                                                                                                       |
| `skillAgentMap` | `[].pattern`                        | _(none)_                         | Regex pattern to match skill names                                                                                                                          |
|                 | `[].agent`                          | _(none)_                         | Agent name to assign when pattern matches                                                                                                                   |
| `summarization` | `enabled`                           | `false`                          | Enable proactive context compaction                                                                                                                         |
|                 | `trigger.type`                      | `tokens`                         | Trigger type (`tokens`, `messages`, `fraction`)                                                                                                             |
|                 | `trigger.value`                     | `100000`                         | Trigger threshold value                                                                                                                                     |
|                 | `keepMessages`                      | `5`                              | Most recent messages kept verbatim after compaction (older history becomes one summary)                                                                     |
|                 | `keep` _(deprecated)_               | _(none)_                         | Legacy form; a `messages` value is used when `keepMessages` is unset                                                                                        |
| `vector`        | `model`                             | `local`                          | Embedding model (`local` or `openai`)                                                                                                                       |
|                 | `projects.<name>.rootDir`           | `.`                              | Project root directory to scan                                                                                                                              |
|                 | `projects.<name>.dbPath`            | _(none)_                         | Path to sqlite-vec database file                                                                                                                            |
|                 | `projects.<name>.chunkSize`         | `96`                             | Lines per chunk                                                                                                                                             |
|                 | `projects.<name>.chunkOverlap`      | `16`                             | Overlap between consecutive chunks                                                                                                                          |
|                 | `projects.<name>.maxFileSize`       | `524288`                         | Max file size in bytes (500 KB)                                                                                                                             |
|                 | `projects.<name>.include`           | `["src/**/*.js", ...]`           | Glob patterns for files to index                                                                                                                            |
|                 | `projects.<name>.exclude`           | `["node_modules/**", ...]`       | Glob patterns for files to exclude                                                                                                                          |

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

The `summarization` section controls proactive context compaction. When `enabled` is `false` (the default), deepagents' library default applies — a 170k token trigger that keeps the last 6 messages, and compaction only happens **reactively** after a request overflows the context window. When `enabled` is `true`, madz registers its own `SummarizationMiddleware` that fires at the configured `trigger`, so compaction is **proactive**.

```yaml
summarization:
  enabled: true
  trigger:
    type: tokens
    value: 100000
  keepMessages: 5
```

When the trigger fires, madz summarizes the history and **rewrites the checkpointer** to `[summary, ...last keepMessages messages]`. The system prompt is injected on every call rather than stored in state, so it is unaffected. The old history is not kept in state; the summarized messages are saved best-effort to `/conversation_history/` and the summary links to that file.

- **`trigger`** — the threshold at which compaction fires. `tokens` counts the system prompt plus all stored messages; `messages` counts stored messages. `fraction` is not supported by the proactive middleware.
- **`keepMessages`** — how many recent messages stay verbatim (default `5`). The tail never starts on a tool result: if the boundary lands on one, the whole tool call and result are summarized and the tail shrinks (possibly to zero).
- **`contextFraction`** (default `0.8`) — when the model's context length can be resolved at startup, the trigger is overridden with 80% of that context length (the configured `trigger.value` is then only a fallback).

The summary is stored as a user message (some providers reject mid-conversation system messages). If summarization fails, state is left unchanged, a warning is logged, and compaction is retried after a few more messages; the reactive context-window handler remains the safety net. `/compact` uses the same routine.

Token counts come from the model's real tokenizer — the same count the status bar shows — so a status bar at 80% means compaction fires on the next model call. If the tokenizer is unavailable or errors, a characters-per-token estimate is used.

**Note:** the custom middleware reaches the **orchestrator only**. Subagents are not forked, so they keep the library default `SummarizationMiddleware`.

### API Tool

The `api` tool takes its policy from the `api` config section, not from model input: the model cannot supply an allowlist, rate limit, or token. It can only name a credential profile.

```yaml
api:
  allowlist:
    - api.github.com
    - "*.example.com"
  rateLimit: 10
  maxRedirects: 5
  maxRetries: 2
  credentials:
    github:
      type: bearer
      tokenEnv: GITHUB_TOKEN
      hosts:
        - api.github.com
    internal-svc:
      type: basic
      usernameEnv: SVC_USER
      passwordEnv: SVC_PASS
    partner:
      type: apikey
      key: X-API-Key
      tokenEnv: PARTNER_KEY
```

- **Credential profiles** hold the _names_ of environment variables, never secrets. `bearer` needs `tokenEnv`; `apikey` needs `tokenEnv` and `key` (the header name); `basic` needs `usernameEnv` and `passwordEnv`. An incomplete profile fails config validation.
- **`hosts`** limits where a credential may be sent (exact host or `*.wildcard`). Empty means any host the allowlist permits. Credentials are also dropped when a redirect crosses origins.
- **`allowlist`** matches on parsed URL parts, never string prefixes. Entries can be a host, a `*.wildcard`, `host:port`, or a full origin with an optional path prefix. An empty list allows any host, **including internal and private addresses** (e.g. `localhost`, RFC 1918, `169.254.169.254`). Set an allowlist if you need to prevent that.
- Redirects are followed manually and every hop is re-checked against the blocked schemes and the allowlist.

### Browser Tool

The `browser` tool takes its policy from the `browser` config section, not from model input:

```yaml
browser:
  allowlist: []
  timeoutMs: 30000
  sessionIdleTimeoutMs: 300000
  maxSessions: 5
  maxContentChars: 200000
  networkIdleMs: 500
```

- **`allowlist`** uses the same matching as the `api` tool (host, `*.wildcard`, `host:port`, or an origin with an optional path prefix). It is checked for every HTTP(S) request the page makes: the `navigate` URL, redirects, and sub-resources such as scripts, images, XHR and iframes. An empty list allows any host, **including internal and private addresses**; the `file:`, `gopher:` and `dict:` schemes are always blocked. `data:`, `blob:` and `about:` URLs never touch the network and are not checked. WebSocket connections are not covered by request interception.
- **`timeoutMs`** is the default per-call timeout; a call's own `timeout` overrides it. It applies to every action.
- **`sessionIdleTimeoutMs`** closes a session after this long without use. **`maxSessions`** caps open sessions; opening one beyond the cap closes the least recently used.
- **`maxContentChars`** truncates the text `extract` and `evaluate` return, and the result is flagged `truncated`.
- **`networkIdleMs`** is the quiet time `waitFor` treats as network idle.
- Chromium runs with `--no-sandbox` (needed in the container), so it has no process isolation of its own. Keep `allowlist` set if the model should not reach internal hosts.

### Rate Limiting

When `openai.rateLimit.maxTokensMinute` is set to a positive value, outgoing LLM requests are paced against a rolling 60-second token budget. Before a request is dispatched, its estimated token cost (input tokens plus the `maxTokens` output budget) is checked against the budget; if adding it would exceed the limit, the request is delayed until the window has room. Set to `0` (the default) to disable the throttle.

On a `429` rate-limit response, the request is retried once after the `retry-after` header value (in seconds or as an HTTP-date). If no `retry-after` header is present, the retry waits a default of **60 seconds**. This applies only when `maxTokensMinute` is enabled; when it is `0`, no retry occurs and the error surfaces immediately.

**Optional — Environment Variable Overrides:**

| Variable                    | Default  | Description                                                     |
| --------------------------- | -------- | --------------------------------------------------------------- |
| `SKILL_AGENT_MAP_0_PATTERN` | _(none)_ | First skill-to-agent pattern                                    |
| `SKILL_AGENT_MAP_0_AGENT`   | _(none)_ | First skill-to-agent mapping                                    |
| `SKILL_AGENT_MAP_1_PATTERN` | _(none)_ | Second skill-to-agent pattern                                   |
| `SKILL_AGENT_MAP_1_AGENT`   | _(none)_ | Second skill-to-agent mapping                                   |
| `AGENT_SAMPLING`            | `true`   | Enable the `sampling` tool; `false` disables registration       |
| `AGENT_BUNDLED_SKILLS`      | `true`   | Load bundled `.skills/` skills; `false` loads only `reflection` |
