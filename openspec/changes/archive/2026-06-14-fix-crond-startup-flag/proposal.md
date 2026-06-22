## Why

Crontab jobs managed via the cronJob tool can be created, listed, and updated successfully, but they never execute in the Docker container. The root cause is that `docker-entrypoint.sh` starts crond with `crond -f &` — the `-f` flag forces foreground mode, which is intended for debugging. When backgrounded with `&`, crond does not properly daemonize, preventing it from reading and executing crontab entries.

## What Changes

- Change `crond -f &` to `crond &` in `docker-entrypoint.sh` (line 22)
- Add a test that validates the entrypoint starts crond without the `-f` flag

## Capabilities

### New Capabilities
- `crond-startup`: Validation that crond starts as a proper background daemon in the Docker entrypoint

### Modified Capabilities
<!-- None — this is a bug fix, not a requirement change -->

## Impact

- **Code**: `docker-entrypoint.sh` — single line change
- **Tests**: New test for entrypoint crond startup validation
- **Docker**: No image changes, no dependency changes
- **No breaking changes** — this fixes broken behavior, doesn't change the API
