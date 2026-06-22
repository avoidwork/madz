## Context

The scheduler module manages cron job definitions in two places: system crontab entries (via `Cron` in `cron.js`) and persisted job files (via `persistJobFile` in `autoSchedule.js`). A code audit identified that `job.command` is interpolated directly into crontab entries without sanitization, and that `persistJobFile` ignores its `cwd` parameter.

## Goals / Non-Goals

**Goals:**
- Prevent crontab format injection by sanitizing command strings before crontab interpolation
- Fix `persistJobFile` to use the `cwd` parameter for the schedules directory path
- Add tests to prevent regression

**Non-Goals:**
- Changing the crontab entry format or structure
- Modifying how commands are executed
- Adding new scheduler features or capabilities

## Decisions

1. **Sanitize by stripping line-breaking characters only**
   - Rationale: Only newlines and carriage returns break crontab parsing. Shell special characters (`$`, `` ` ``, `|`, `;`) are handled by the shell at execution time and should not be stripped.
   - Alternatives considered: Rejecting commands with any special characters (too restrictive), escaping all special characters (would break legitimate commands).

2. **Place sanitization helper at module level in `cron.js`**
   - Rationale: The helper is only used by the `Cron` module. Keeping it internal maintains encapsulation.
   - Alternatives considered: Placing it in a shared utilities module (overkill for a single-module concern).

3. **Direct parameter substitution for `persistJobFile`**
   - Rationale: The `cwd` parameter is already passed from `autoScheduleCallback()` as `process.cwd()`. Simply using it as-is is the minimal, correct fix.
   - Alternatives considered: Adding path validation or resolution (unnecessary complexity since the caller always provides a valid path).

## Risks / Trade-offs

- [Risk: Sanitization could break edge-case commands] → Mitigation: Only strip `\n`, `\r\n`, `\r`. All other characters pass through unchanged.
- [Risk: Existing crontab entries with injected content remain] → Mitigation: The `sync()` method will re-write the block with sanitized entries on next run.