## Why

The session saver currently calls `mkdir(dir, { recursive: true })` on every save call. This means directory creation happens N times (once per conversation message) instead of once at init. After init, if the directory disappears, the agent continues running with no persistence but no signal either.

## What Changes

- Move the `mkdir(dir, { recursive: true })` call from `saveSession()` to a single initialization function (`ensureSessionsDir`) that runs once at app startup in `index.js`. After a successful init, the directory is considered guaranteed.
- If the directory disappears after successful init, `saveSession()` no longer silently creates it — it throws, and the shutdown handler treats this as fatal (crash).
- `saveSession()` becomes a pure write: it validates the directory exists via `stat()` and writes the file, with no mkdir fallback.

## Capabilities

### Modified Capabilities
- `session-management`: Shutdown and cleanup now requires the sessions directory to exist; missing directory is a crash condition.

## Impact

- `src/session/saver.js` — remove `mkdir`, replace with `stat()` validation (pure write)
- `src/session/index.js` — add `ensureSessionsDir()` for one-time init check/create
- `src/index.js` — call `ensureSessionsDir()` at startup once
- `src/session/shutdown.js` — re-throw `saveSession` errors as fatal
- `tests/unit/saver.test.js` — update tests for new failure semantics; add init-ensure test
