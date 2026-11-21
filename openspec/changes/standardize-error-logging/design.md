# Design

## Context

See proposal.md - Why. The structured `logger` singleton already exists at `src/shared/logger.js` (pino-based, PII-redacted, never-throw invariant). The problem is not the absence of a logger but the inconsistent application of it: a minority of catch blocks swallow errors silently. This change standardizes on the existing logger and resolves the `logError` helper ambiguity.

## Goals / Non-Goals

**Goals:**
- Every caught error in `src/` is either logged via the structured `logger` or explicitly documented as an intentional swallow.
- Resolve the `logError(err, context)` helper ambiguity — one convention, not two.
- Preserve the never-throw invariant.

**Non-Goals:**
- Not introducing a new logging abstraction.
- Not changing the log sink, format, or PII redaction.
- Not altering existing error-handling semantics (swallowed errors stay swallowed, re-thrown errors stay re-thrown).

## Decisions

### Decision 1: Promote `logError` as the standard catch-block logger
`logError(err, context)` is already exported from `src/shared/logger.js` and is the safest way to log from within a catch block — it never throws and falls back to stderr. However, it is currently used only within `logger.js` itself (12 sites). 

**Chosen:** Promote `logError` for use across the codebase in catch blocks where the error is being handled (not re-thrown). It provides a consistent, never-throw path for logging caught errors.

**Alternatives considered:**
- *Deprecate `logError` in favor of direct `logger.error` calls* — rejected because `logError` is the only never-throw path; direct `logger.error` can throw if pino fails, and callers would need to wrap it.
- *Leave as-is* — rejected because it leaves two conventions.

### Decision 2: Level selection for benign vs. unexpected failures
Use `warn` or `debug` for expected/benign conditions (ENOENT, missing optional file, invalid URL in a hot path) and `error` for genuine unexpected failures. This avoids log noise during normal operation while preserving signal for real problems.

### Decision 3: Intentional swallows are documented, not logged
Sites where swallowing is by design (e.g., `src/stream/loopDetector.js` — a failed check must never break streaming; `src/vector/indexerWorker.js` — serialization queue guard; response-body read fallbacks) get an explicit comment stating why the error is non-fatal. Logging these would add noise for conditions that are by design non-fatal.

## Risks / Trade-offs

- [Increased log volume on previously-silent paths] → Use `debug`/`warn` levels on hot paths (e.g., `urlFilter`) to avoid noise while preserving signal.
- [Accidentally logging benign conditions as `error`] → Careful level selection; ENOENT and similar expected conditions use `warn`/`debug`.
- [Promoting `logError` changes call sites across many modules] → Keep the change scoped to the silent-catch sites identified in the audit; do not rewrite already-correct `logger.error` calls.

## Migration Plan

1. Promote `logError` usage in the identified silent-catch sites.
2. Add explicit documentation comments to intentional swallows.
3. Add unit tests asserting failures are logged (mock `logger`).
4. Run `npm run test`, `npm run lint`, `npm run coverage`.

## Open Questions

None.
