## Context

Madz schedules jobs via the system crontab. Crontab entries are written by `src/scheduler/cron.js` in the `add()`, `install()`, and `sync()` methods. Each entry is formatted as `<cron>  <command>  # madz-schedule: <name>`. The command is processed by `prepareCrontabCommand()` which currently only calls `sanitizeCrontabCommand()` (strips newlines).

Cron runs commands in a minimal environment — no `.bashrc`, no `.profile`, no inherited shell variables. This means environment variables like `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `NODE_OPTIONS`, and `TZ` are unavailable, causing scheduled node processes to fail silently.

## Goals / Non-Goals

**Goals:**
- Create a `.env.cron` file at application startup containing all required environment variables.
- Prepend `. /{cwd}/.env.cron 2>/dev/null || true && ` to every crontab command via `prepareCrontabCommand()`.
- Ensure the env file is written before any crontab sync occurs.
- Add tests for both the env file writer and the command prefixing.

**Non-Goals:**
- Configurable env file path or name.
- Per-job environment overrides.
- Environment variable validation or schema enforcement.
- Hot-reloading the env file (written once at startup).

## Decisions

### Decision 1: Write `.env.cron` at startup, not lazily
**Rationale:** The env file must exist before any crontab entry is written. Writing at startup in `index.js` (before the `Cron.sync()` call) guarantees availability. Lazy writing on first schedule install would create a race condition where the first crontab write could fail.

### Decision 2: Whitelist specific variables from `process.env`
**Rationale:** Writing the full `process.env` would leak sensitive data (tokens, passwords) to disk. Instead, we write only the variables that cron jobs actually need: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `NODE_OPTIONS`, `TZ`, and any variables listed in a configurable allowlist. This keeps the file minimal and secure.

### Decision 3: Prepend sourcing in `prepareCrontabCommand()` rather than in `add()`/`install()`/`sync()`
**Rationale:** `prepareCrontabCommand()` is the single point where all crontab commands pass through. Modifying it ensures every code path (add, install, sync) gets the fix without duplicating logic. This is the most maintainable approach.

### Decision 4: Use `. /{cwd}/.env.cron 2>/dev/null || true && ` prefix
**Rationale:** The dot (`.`) command sources the file in the current shell. The `2>/dev/null` suppresses errors if the file is missing (e.g., during development without startup). The `|| true` ensures the chain doesn't abort on failure. The `&&` ensures the actual command only runs if sourcing succeeds. This is defensive but not disruptive.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| `.env.cron` file contains secrets on disk | Only whitelisted variables are written. File permissions default to 0600 (owner read/write only). |
| Sourcing fails silently, jobs still run | `2>/dev/null || true` means a missing file won't abort the job. This is intentional — the job should still attempt to run even without env vars. |
| Existing crontab entries need regeneration | On next startup, `Cron.sync()` will rewrite all entries with the new prefix. No manual intervention needed. |
| Windows compatibility | Crontab is a Unix concept. This fix is Unix-only, consistent with the existing codebase. |

## Migration Plan

1. Deploy the code change.
2. On next startup, `.env.cron` is written automatically.
3. On next startup, `Cron.sync()` rewrites all crontab entries with the sourcing prefix.
4. No rollback needed — removing the sourcing prefix simply reverts to the old (broken) behavior, which is safe.

## Open Questions

- Should the whitelist of variables be configurable via `config.yaml`? (Defer to future enhancement.)
- Should we log a debug message when `.env.cron` is written? (Yes, using existing logger.)
