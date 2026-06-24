## Context

The subAgent tool in `src/tools/subAgent.js` manages child process spawning with configurable timeouts and session isolation. Two environment variables were introduced as configuration paths: `MADZ_SUBAGENT_TIMEOUT` (a per-process timeout override) and `MADZ_SESSION_ID` (for session isolation). However, `MADZ_SUBAGENT_TIMEOUT` creates a third configuration tier that bypasses the centralized config system, and `MADZ_SESSION_ID` is passed to child processes but never consumed by either parent or child.

The `config.yaml` already defines `process.subAgent.timeout: 600000` which is read correctly by the tool for maxConcurrent, defaultStrategy, and defaultOnError — only timeout has the env var detour.

## Goals / Non-Goals

**Goals:**
- Remove `MADZ_SUBAGENT_TIMEOUT` env var check from `resolveTimeout()`, restoring the intended priority chain: per-call → config.yaml → hardcoded default
- Remove `MADZ_SESSION_ID` from child process environment — it's never read
- Update tool description to remove env var reference
- Remove tests that validate the dead env var behavior

**Non-Goals:**
- No changes to config.yaml structure
- No new configuration mechanisms
- No migration path for users relying on MADZ_SUBAGENT_TIMEOUT (they'll silently fall back to config.yaml default, which has the same value)

## Decisions

1. **Remove env var entirely rather than deprecate first** — This is dead code, not a deprecated feature. The env var was never documented as a public API, and the config.yaml default has always been the intended source of truth. A deprecation cycle would add unnecessary noise.

2. **No config.yaml changes needed** — The timeout is already defined in `process.subAgent.timeout: 600000`. The env var was a redundant override path, not a replacement for config.yaml.

3. **Session isolation future-proofing** — If session isolation is needed in the future, it should be implemented through the config system (consistent with maxConcurrent, defaultStrategy, defaultOnError), not ad-hoc environment variables.

## Risks / Trade-offs

- [Risk] Users setting MADZ_SUBAGENT_TIMEOUT in their environment will silently fall back to config.yaml default → **Mitigation**: The config.yaml default (600000ms) is the same value the env var would have used, so behavior is unchanged for anyone using the default. Only users with a custom env var value will see a change, and that value was never documented as a supported configuration path.
- [Risk] Tests explicitly validate env var priority behavior → **Mitigation**: Remove these tests and ensure remaining coverage is adequate for timeout resolution.

## Migration Plan

No migration needed. This is a cleanup of dead code. The config.yaml default is the source of truth and has always been the intended path.

## Open Questions

None. This is a straightforward cleanup with no ambiguity.