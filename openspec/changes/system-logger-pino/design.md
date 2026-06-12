## Context

The project currently has ~10 `console.log`, `console.warn`, `console.error`, and `console.info` calls scattered across `index.js` and several `src/` modules. AGENTS.md requires a structured JSON logger and prohibits silent `console.log` in production code. Telemetry (OpenTelemetry) is already wired via `src/telemetry/provider.js`, but it handles tracing/spans — not application-level structured logging.

Constraints:
- Must work on Alpine Linux (Docker), standard Linux, macOS, and Windows.
- Must respect Node.js 24+ with ESM (`"type": "module"`).
- Must not break the CLI output paths (stdout must remain intact for `--json` mode, TUI, and interactive prompts).
- 100% test coverage is enforced by the pre-commit hook.

## Goals / Non-Goals

**Goals:**
- Single source of truth for application logging via pino.
- Dual-file output: info+ logs in `madz.log`, error-only in `madz_error.log`.
- OS-aware log directory following XDG/standard conventions.
- Zero `// oxlint-disable no-console` pragmas in `src/` production code.
- Logger singleton accessible via import from `src/logger.js`.
- TUI and `--json` CLI output remain on stdout/stderr.

**Non-Goals:**
- Log rotation or max file size limits (future enhancement).
- Transport to external log aggregation (future, e.g., Loki, Datadog).
- Telemetry-log correlation (may be added later alongside OTel span injection).
- Changing the TUI (Ink) rendering or stdin/stdout behavior.

## Decisions

### 1. Use pino with two separate transports (file streams)
Pino natively supports `destination` streams and multiple transports. Two pino child instances or a primary logger with dual `pino.transport` targets is the cleanest approach.

**Chosen approach**: Use a single pino instance with two `pino.transport` targets via the `pino-multistream` pattern (pino's built-in `levels` + separate file descriptors). Since pino supports writing multiple destinations natively via separate child loggers, we create:
- `logger.info.warn.debug.trace.trace` → writes to `madz.log`
- `logger.error` → writes to `madz_error.log` AND `madz.log`

Actually simpler: use separate pino instances sharing the same level/serializers configuration:
```js
const baseOpts = { level: 'info', timestamp: pino.stdTimeFunctions.isoTime };
const logger = pino(pino.multistream([
  { stream: createFileStream('madz.log'), level: 'info' },
  { stream: createFileStream('madz_error.log'), level: 'error' },
]), baseOpts);
```

Pino's `multistream` is built-in (no extra dependency). This ensures errors appear in both files.

**Rationale**: Built-in pino feature, zero extra deps, clean separation of concerns.

### 2. OS-aware log directory
- **Alpine/Docker** (detected via `/proc/version` containing "alpine" or `process.platform === 'linux'` + `/etc/alpine-release` exists): `~/.cache/madz/logs/`
- **Standard Linux**: `~/.local/share/madz/logs/`
- **macOS**: `~/Library/Logs/madz/`
- **Windows**: `%LOCALAPPDATA%\madz\logs\`

Detection order:
1. Check `/etc/alpine-release` exists → Alpine path
2. Check `process.platform` for macOS / Windows
3. Default → XDG `~/.local/share/`

After determining the directory, create it with `mkdirSync(dir, { recursive: true })`.

**Rationale**: XDG spec on Linux, platform-native conventions elsewhere. `/etc/alpine-release` is the most reliable Docker/Alpine detection.

### 3. Logger API
The `src/logger.js` module exports:
```js
export const logger = {
  info: (msg, ...args) => pinoLogger.info(msg, ...args),
  warn: (msg, ...args) => pinoLogger.warn(msg, ...args),
  error: (msg, ...args) => pinoLogger.error(msg, ...args),
  debug: (msg, ...args) => pinoLogger.debug(msg, ...args),
  fatal: (msg, ...args) => pinoLogger.fatal(msg, ...args),
  silent: () => {},
};
```

Each function accepts a message string and optional JSON-serializable object for structured fields (consistent with AGENTS.md JSDoc + structured logging requirements).

**Rationale**: Familiar `logger.info(msg, obj)` API matching pino's interface. Easy drop-in replacement for `console.log(msg)`.

### 4. Silent mode for tests
The logger checks `process.env.NODE_ENV === 'test'` and `process.env.OPENCODE_TEST === 'true'` or similar. In test mode, pino's stream is redirected to `/dev/null` equivalent or a pino transport that discards output.

Actually, simpler: pino with `level: 'silent'` when `test` mode is detected.

**Rationale**: Prevents log pollution in test output without needing mock wrappers.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Log directory not writable (permissions) | Catch `mkdirSync`/write errors silently; fall back to `tmpdir()` |
| Pino not yet installed | Add in tasks as first step (`npm install pino`) |
| Log file handles held open across graceful shutdown | Use pino's `onClose` hook or ensure logger is flushed on shutdown signal |
| Structured logger vs CLI output confusion | `--json` CLI output and TUI rendering remain direct `process.stdout.write`; logger only for log files + stderr |

## Open Questions

1. Should errors write to both `madz.log` AND `madz_error.log`? (Current design: yes.)
2. Should there be a `level` config option in `config.yaml`? (Not in scope; hardcoded to `info`.)
