## Context

The Docker container for madz uses Alpine Linux with the `cronie` package installed. The entrypoint script (`docker-entrypoint.sh`) starts three processes:
1. sshd — for remote access
2. crond — for scheduled job execution
3. CMD (`sleep infinity`) — to keep the container alive

The crond line currently reads: `crond -f &`. The `-f` flag is Alpine's cronie foreground mode, intended for debugging. When combined with `&`, it creates a conflict — crond tries to stay in the foreground while the shell backgrounds it.

## Goals / Non-Goals

**Goals:**
- Fix crond startup so scheduled jobs actually execute
- Add a test to prevent regression

**Non-Goals:**
- Changes to crontab management logic
- Changes to job definitions or scheduler behavior
- Integration tests requiring a live Docker container

## Decisions

1. **Remove `-f` flag, keep `&`**: `crond &` (without `-f`) allows crond to properly daemonize — fork to background, detach from terminal, and begin its cron loop. This is the standard way to run crond as a background service.

   *Alternatives considered:*
   - `crond -f &` (current) — broken, causes the issue
   - `crond` (no `&`) — would block the entrypoint, preventing CMD from running
   - `crond -f` (no `&`) — same problem, blocks entrypoint

2. **No spec delta needed**: This is a bug fix, not a requirement change. The existing cron-scheduler spec already requires that scheduled jobs execute. The fix restores expected behavior.

## Risks / Trade-offs

- **[Minimal]** The `-f` flag was added in commit 482475a. There's a small chance it was intentionally used for some edge case. However, foreground mode has no place in a production daemon, and the bug report confirms jobs don't run with the current approach.
- **Mitigation**: The fix is reversible with a single-line revert. A test is added to prevent regression.

## Migration Plan

1. Apply the change to `docker-entrypoint.sh`
2. Add test for entrypoint validation
3. Commit, push, open PR
4. After merge, users redeploying containers will have working crontab jobs

No rolling update needed — the fix takes effect on container restart/redeploy.
