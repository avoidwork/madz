# Design

## Context

See proposal.md - Why. Three promise chains in the TUI layer (`src/tui/systemPanel.js` and `src/tui/app.js`) lack rejection handlers. The affected chains are best-effort background operations: system info gathering and dynamic module loading for Copilot auth. See the specs for the behavioral requirements.

## Goals / Non-Goals

**Goals:**
- Add explicit `.catch()` rejection handlers to all three promise chains.
- Preserve the existing `cancelled`/`disposed`/generation-counter guards exactly.
- Ensure no unhandled promise rejection is emitted on failure.

**Non-Goals:**
- No change to the success-path control flow.
- No change to system info gathering or the Copilot auth flow.
- No new UI surface or user-visible behavior change.

## Decisions

**Decision 1: Rejection handlers are no-ops (or log a warning) rather than surfacing errors in the UI.**
These are best-effort background operations. Surfacing a system-info gathering failure or a dynamic-import failure in the UI would add noise without actionable value. The handlers swallow the rejection (optionally logging a warning) so the process does not crash on an unhandled rejection.
- *Alternative considered:* Surfacing the error in the UI. Rejected because it adds noise for non-actionable background failures.

**Decision 2: Preserve the existing guards rather than restructuring the async flow.**
The fix is additive — it only appends `.catch()` handlers. The `cancelled` flag in `systemPanel.js` and the `disposed` flag / `authHandlerGenRef.current === myGen` generation counter in `app.js` remain untouched. This minimizes the diff and avoids introducing regressions in the success path.
- *Alternative considered:* Refactoring to `async/await` with try/catch. Rejected because it is a larger diff with no behavioral benefit for this fix.

## Risks / Trade-offs

- [Rejection handler swallows an error that might warrant attention] → The handlers log a warning (where a logger is available) so the failure is not entirely silent; the primary goal is preventing an unhandled rejection crash.
- [Adding a `.catch()` could mask a genuine bug] → The success-path guards are preserved, so the change only affects the failure path; any underlying failure is still observable via logging.

## Migration Plan

No migration required. This is a source-only change with no data or config impact. Rollback is a revert of the two-file diff.
