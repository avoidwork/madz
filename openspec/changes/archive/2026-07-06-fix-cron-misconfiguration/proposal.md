## Why

Cron jobs defined in the user crontab are silently ignored because crond is running without the `-p` flag (permit any crontab). Secondary issues include PATH mismatch (node at `/usr/local/bin/node` outside crond's default PATH) and no output logging. This means scheduled jobs like Canadian News emails and daily reflections never execute, with no visible errors.

## What Changes

- Restart crond with proper flags: `-p` (allow user crontabs), `-P` (inherit PATH), `-s` (log to syslog)
- Update crontab entries to use full node path (`/usr/local/bin/node`)
- Add output redirection to `/var/log/cron-madz.log 2>&1` for visibility

## Capabilities

### New Capabilities
- `cron-reliability`: Ensures cron jobs execute reliably by fixing crond configuration and adding observability

### Modified Capabilities
<!-- None — this is a new capability -->

## Impact

- `Dockerfile` — crond startup command and crontab entries
- Deployment configuration — crond behavior changes
- No application code changes required