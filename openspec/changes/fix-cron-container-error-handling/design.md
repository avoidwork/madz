## Context

The `src/scheduler/cron.js` module manages crontab entries for the madz application. The `_readCrontab()` method (lines 46-59) is responsible for reading the current system crontab before writing madz-managed entries. Currently, it executes `crontab -l` and catches errors, but only returns an empty string for "no crontab" messages. All other errors (e.g., "binary not found", "permission denied") are re-thrown, causing the crontab sync to fail.

In Docker container environments, `crontab -l` frequently fails with errors other than "no crontab" — the crontab binary may not be installed, permissions may be restricted, or the command may simply not be available. Since madz fully manages the crontab in container contexts (there's no pre-existing user crontab to preserve), these errors should be treated the same as "no crontab" — return an empty string and proceed with writing the madz block.

## Goals / Non-Goals

**Goals:**
- Make `_readCrontab()` return `""` for ALL errors, not just "no crontab" messages
- Allow crontab sync to proceed even when the initial crontab is unreadable
- Update unit tests to reflect the new error handling behavior

**Non-Goals:**
- Changes to Dockerfile or container orchestration
- Changes to crontab management logic beyond error handling
- Support for preserving pre-existing user crontab entries in containers

## Decisions

**Decision: Return `""` for all errors in `_readCrontab()`**
- **Rationale:** In container environments, madz fully manages the crontab. There's no pre-existing user crontab to preserve, so any error reading the crontab is equivalent to "no crontab". Returning `""` allows the sync to proceed unconditionally.
- **Alternatives considered:**
  1. *Check for container environment before changing behavior:* Added complexity, fragile detection logic. The fix should work regardless of environment detection.
  2. *Log errors but still return `""`:* Could be added later if needed for debugging, but not required for the fix.
  3. *Throw a specific "CrontabUnavailable" error:* Would require changes to the caller to handle this error, adding complexity without benefit.

**Decision: No changes to the caller of `_readCrontab()`**
- **Rationale:** The caller already handles `""` as "no existing crontab" and proceeds to write the madz block. No changes needed upstream.

## Risks / Trade-offs

**Risk:** Suppressing all errors may hide legitimate issues in non-container environments (e.g., permission problems that should be surfaced).
→ **Mitigation:** The behavioral change is safe because the crontab sync will proceed regardless — if there's a real permission issue, it will surface when madz tries to write the new crontab. Additionally, in non-container environments, users typically have a pre-existing crontab, so the "no crontab" path is rarely hit anyway.

**Risk:** Tests may fail if they expect errors to be thrown for non-"no crontab" scenarios.
→ **Mitigation:** Update all relevant unit tests in `tests/unit/cron.test.js` to expect `""` return value for all error scenarios.