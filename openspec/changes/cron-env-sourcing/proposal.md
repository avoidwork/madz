## Why

Cron jobs managed by madz fail silently because they run in a minimal shell environment with no inherited environment variables. API keys (`OPENAI_API_KEY`, `OPENAI_BASE_URL`), runtime flags (`NODE_OPTIONS`), and timezone (`TZ`) are all missing, causing scheduled node processes to crash or behave incorrectly. This is a bug — scheduled jobs that appear configured are non-functional in production.

## What Changes

- Add `writeEnvCron()` function to `src/scheduler/cron.js` that writes a `.env.cron` file to the project working directory containing all required environment variables.
- Modify `prepareCrontabCommand()` in `src/scheduler/cron.js` to prepend `. /{cwd}/.env.cron 2>/dev/null || true && ` to every crontab command.
- Call `writeEnvCron()` during application startup in `index.js`, before the crontab sync step.
- Add tests for both new functionality.

## Capabilities

### New Capabilities
- `cron-env-sourcing`: Automatic creation and sourcing of environment variables for cron-managed scheduled jobs.

### Modified Capabilities
- `scheduler`: Crontab entries now include environment sourcing prefix; the scheduler module gains a new responsibility (env file generation) but the public API surface remains unchanged.

## Impact

- **Affected code**: `src/scheduler/cron.js` (new function, modified `prepareCrontabCommand`), `index.js` (startup call), `src/scheduler/cron.test.js` (new tests).
- **No breaking changes**: The public API of `Cron` is unchanged. Existing crontab entries are updated with the sourcing prefix on next sync/install.
- **No new dependencies**: Uses only built-in Node.js `fs` and `process.env`.
- **Security**: Only whitelisted variables are written to disk (not the full `process.env`).

## Non-goals

- Adding a config option to disable `.env.cron` generation (this is a bug fix, not optional).
- Supporting custom env file paths or names (`.env.cron` is the standard).
- Adding environment variable validation or schema checking (out of scope).
- Supporting per-job environment overrides (all jobs share the same env file).
