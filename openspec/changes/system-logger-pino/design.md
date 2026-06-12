## Context

The project currently has `console.log` and `console.warn` calls scattered across 5 files in `src/` and `index.js`. AGENTS.md requires a structured JSON logger and prohibits silent `console.log` in production code. Telemetry (OpenTelemetry) is already wired via `src/telemetry/provider.js`, but it handles tracing/spans — not application-level structured logging.

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

### 1. Use pino with `pino.multistream` for dual-file output

Pino's built-in `pino.multistream()` supports writing to multiple destination streams from a single logger instance. We use it to route logs to two files:

```js
const baseOpts = { level: 'debug', timestamp: pino.stdTimeFunctions.isoTime };
const logger = pino(
  pino.multistream([
    { stream: createFileStream('madz.log'), level: 'info' },
    { stream: createFileStream('madz_error.log'), level: 'error' },
  ]),
  baseOpts,
);
```

- `logger.info/warn/debug/trace` → writes to `madz.log` only
- `logger.error/fatal` → writes to **both** `madz.log` and `madz_error.log`

**Rationale**: Built-in pino feature (no extra dependency), writes in the main thread (no worker thread overhead), clean separation of concerns.

**Constraint**: The logger's `level` must be set to the lowest level used in any stream (`debug` here), since `multistream` routes based on per-stream `level` thresholds.

### 2. OS-aware log directory
- **Alpine/Docker** (detected via `/etc/alpine-release` existing): `~/.cache/madz/logs/`
- **Standard Linux**: `~/.local/share/madz/logs/`
- **macOS**: `~/Library/Logs/madz/`
- **Windows**: `%LOCALAPPDATA%\madz\logs\`

Detection order:
1. Check `/etc/alpine-release` exists (and is non-empty) → Alpine path
2. Check `process.platform` for macOS / Windows
3. Default → XDG `~/.local/share/`

After determining the directory, create it with `mkdirSync(dir, { recursive: true })`. If the directory is unwritable, fall back to `os.tmpdir()`. If the fallback is also unwritable, silently discard logs.

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
The logger checks `process.env.NODE_ENV === 'test'`. In test mode, pino is configured with `level: 'silent'` to suppress all output.

**Rationale**: Prevents log pollution in test output without needing mock wrappers.

### 5. Shutdown flush
The shutdown handler in `src/session/shutdown.js` SHALL call `await logger.flush()` before process exit. This ensures all buffered log entries are written to disk.

**Rationale**: `pino.multistream` writes in the main thread and does not have automatic flush-on-exit hooks (unlike `pino.transport` worker threads). Without explicit flush, log entries buffered in memory could be lost on SIGTERM/SIGINT or `process.exit()`.

**Safety net**: `logger.fatal()` auto-flushes synchronously, providing a partial safety net for unexpected crashes.

## Risks / Trade-offs

|| Risk | Mitigation |
||---|---|
|| Log directory not writable (permissions) | Catch `mkdirSync`/write errors silently; fall back to `tmpdir()`, then silently discard if fallback also fails |
|| Pino not yet installed | Add in tasks as first step (`npm install pino`) |
|| Log file handles held open across graceful shutdown | Shutdown handler calls `await logger.flush()` before process exit |
|| Structured logger vs CLI output confusion | `--json` CLI output and TUI rendering remain direct `process.stdout.write`; logger only for log files + stderr |
|| Multistream interleaving on concurrent writes | Single-process Node.js app — negligible risk. Pino writes are atomic for small entries on Linux. |
