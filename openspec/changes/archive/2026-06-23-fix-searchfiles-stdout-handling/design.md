## Context

The searchFiles tool in `src/tools/filesystem.js` uses `execFile` to run the ripgrep (`rg`) CLI. When `stdout` is undefined (e.g., due to encoding issues or edge cases), the current code `stdout?.trim() ?? stdout` evaluates to `undefined`, causing a TypeError on the subsequent `output.split("\n")` call.

## Goals / Non-Goals

**Goals:**
- Fix the undefined stdout handling to prevent ReferenceError/TypeError
- Ensure `output` is always a string before calling `split()`

**Non-Goals:**
- No changes to search logic, pattern matching, or tool schema
- No changes to error handling for ENOENT or timeout cases (already handled)

## Decisions

**Decision: Use `(stdout ?? "").trim()` instead of `stdout?.trim() ?? stdout`**
- Rationale: The nullish coalescing operator `??` ensures we always have a string to call `.trim()` on. An empty string is already handled by the existing `if (!output)` check.
- Alternatives considered:
  - `stdout ? stdout.trim() : ""` — equivalent but more verbose
  - `String(stdout ?? "").trim()` — also works but `String()` on null/undefined produces "null"/"undefined" strings, which is not desired

## Risks / Trade-offs

**Risk:** None significant. This is a minimal, surgical fix.
**Trade-off:** None. The fix only changes error handling behavior for an edge case that previously crashed.