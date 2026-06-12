## Why

The codebase uses `console.log`, `console.warn`, and `console.error` across multiple files, including several `// oxlint-disable no-console` pragmas. AGENTS.md mandates using a structured logger and logging at a JSON level. A centralized logger with structured output enables consistent log levels, file-based rotation, and eventual integration with the OpenTelemetry pipeline.

## What Changes

- Add `pino` as a project dependency.
- Create a `src/logger.js` module that exports a pre-configured pino instance.
- Split output into two files: `madz.log` (info and above) and `madz_error.log` (error only).
- Log directory follows OS conventions: `~/.cache/madz/logs/` on Alpine/Docker, `~/.local/share/madz/logs/` on Linux, `~/Library/Logs/madz/` on macOS, `%LOCALAPPDATA%\madz\logs\` on Windows.
- Replace all `console.log`, `console.warn`, and `console.error` calls in `src/` and `index.js` with logger method calls.
- Remove `// oxlint-disable no-console` pragmas from affected files.

## Capabilities

### New Capabilities
- `system-logger`: Structured logging module using pino with OS-aware log directory, dual-file output (info + error), and replacement of all console.* usages across the codebase.

### Modified Capabilities
<!-- No existing spec-level capabilities need requirement changes. -->

## Impact

- **Dependencies**: adds `pino` to `dependencies`.
- **Files created**: `src/logger.js`.
- **Files modified**: `index.js`, `src/session/shutdown.js`, `src/tools/cron.js`, `src/scheduler/autoSchedule.js`, `src/memory/gc.js` (replace console.* with logger calls).
- **Runtime**: logs written to OS-specific user directory on every run; no log rotation configured at this stage.
- **Breaking**: all direct `console.*` calls in production code are removed; only intentional CLI output (e.g., `--json` mode, TUI) retains `console.log`.
