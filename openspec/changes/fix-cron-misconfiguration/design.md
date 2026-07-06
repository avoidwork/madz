## Context

The madz application runs in a Docker container based on Alpine Linux. Scheduled jobs are managed via cron, with entries in the user crontab (owned by the `madz` user). Currently, crond is running as root without the necessary flags to accept user crontabs, causing jobs to be silently ignored.

The Docker image uses Node.js v24.18.0 installed at `/usr/local/bin/node`. The default crond PATH (`/bin:/usr/bin:/sbin:/usr/sbin`) doesn't include this location.

## Goals / Non-Goals

**Goals:**
- Fix crond to accept user crontabs via the `-p` flag
- Ensure crond inherits the correct PATH via the `-P` flag
- Enable syslog logging via the `-s` flag for observability
- Update crontab entries to use absolute paths and log output

**Non-Goals:**
- Changing cron job schedules or commands
- Implementing log rotation
- Adding new scheduled jobs
- Modifying the application code

## Decisions

1. **Use busybox crond flags (`-p -P -s`)**
   - Rationale: These are the standard busybox crond flags for permitting user crontabs, inheriting PATH, and enabling syslog
   - Alternatives considered: Running crond as the `madz` user instead of root — rejected because crond typically runs as root to manage other users' crontabs
   - The `-p` flag is the critical fix — without it, user crontabs are silently ignored

2. **Update crontab entries with absolute paths**
   - Rationale: `/usr/local/bin/node` is outside crond's default PATH
   - Using absolute paths is more reliable than modifying PATH in the crontab itself

3. **Add output redirection to `/var/log/cron-madz.log`**
   - Rationale: Provides visibility into job execution and errors
   - Syslog (`-s` flag) logs crond's own activity, but job stdout/stderr needs separate redirection

## Risks / Trade-offs

[Risk] The `-p` flag behavior may vary slightly between busybox versions
→ Mitigation: Test in the same Alpine version used in production

[Risk] Log file `/var/log/cron-madz.log` could grow unbounded
→ Mitigation: Log rotation is a future enhancement, not blocking

[Risk] Running crond with `-s` may produce verbose syslog output
→ Mitigation: Acceptable — visibility is the goal, can filter later if needed

## Migration Plan

1. Update Dockerfile with new crond flags and crontab entries
2. Rebuild and redeploy the Docker image
3. Verify crond is running with correct flags: `ps aux | grep crond`
4. Verify crontab entries are installed: `crontab -l -u madz`
5. Check logs: `/var/log/cron-madz.log` and syslog

## Open Questions

- None — the fix is straightforward and well-understood from the issue report