## Context

The codebase has two locations where synchronous file system calls (`existsSync()`) are used inside async functions. This blocks the Node.js event loop and violates AGENTS.md §1.1 which prohibits blocking operations inside async functions.

## Goals / Non-Goals

**Goals:**
- Replace `existsSync()` with `fs.promises.access()` in async contexts
- Add debug-level logging to the TUI streaming callback catch block

**Non-Goals:**
- Address `readFileSync()` usage in synchronous utility functions (acceptable per AGENTS.md §1.1)
- Change any public API signatures or behavioral contracts

## Decisions

### Use `fs.promises.access()` instead of `fs.promises.exists()`

**Rationale:** `fs.promises.exists()` was removed in Node.js 22+. The recommended replacement is `fs.promises.access()` with `constants.F_OK`. This is the correct approach for Node.js 24+.

**Alternatives considered:**
- `fs.promises.stat()` — more expensive, unnecessary for existence check
- `try/catch` around `fs.promises.readFile()` — overkill for simple existence check

### Use `access()` with try/catch instead of conditional

**Rationale:** The original code used `if (existsSync(path)) return path`. The replacement uses `try { await access(path); return path; } catch { /* continue */ }`. This is functionally equivalent and follows the same pattern used elsewhere in the codebase (e.g., `scheduler.js` line 88-95).

## Risks / Trade-offs

- **Risk:** `access()` followed by `readFile()` has a TOCTOU race condition — the file could be deleted between the two calls.
  **Mitigation:** The existing code had the same race condition with `existsSync()`. The try/catch around `readFile()` already handles this case.

## Migration Plan

- No migration needed — this is a behavioral-preserving refactor
- All existing tests pass without modification
- No configuration changes required

## Open Questions

- None
