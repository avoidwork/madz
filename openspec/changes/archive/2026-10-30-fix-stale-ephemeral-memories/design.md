# Design

## Context

See proposal.md - Why. The bug is a path double-join in `src/memory/expireEphemeralMemories.js`. The function signature is `expireEphemeralMemories(contextDir, nowStr, cwdParam = cwd)` where `cwd` is `loadConfig().cwd` (the process working directory). The caller in `index.js` line 164 passes an absolute path (`config.cwd + "/" + config.memory.contextDir`), which gets double-joined with `cwdParam` in `join(cwdParam, contextDir)`.

The function has three path-construction sites that must stay consistent:
1. `readdir(join(cwdParam, contextDir))` — line 53 (scan the directory)
2. `readEphemeralFile(contextDir, file)` — line 61, which internally does `join(cwdParam, contextDir, filename)` (read the file)
3. `join(cwdParam, contextDir, file)` — line 63 (unlink the file)

## Goals / Non-Goals

**Goals:**
- Make `expireEphemeralMemories()` tolerate both absolute and relative `contextDir` inputs.
- Ensure the scan path, read path, and unlink path all resolve to the same directory.
- Add regression tests covering absolute-path input, expired-file removal, and non-expired-file retention.

**Non-Goals:**
- No change to the public API signature.
- No change to the `index.js` caller (the function now tolerates absolute paths).
- No refactoring of unrelated code.

## Decisions

**Decision 1: Add an absolute-path guard in the function (Option B) rather than changing the caller (Option A).**
- Rationale: Option A (`expireEphemeralMemories(config.memory.contextDir)`) fixes only the one caller in `index.js`. Option B makes the function robust for any caller that passes an absolute path, which is the more defensive and durable fix. It also keeps the `index.js` call unchanged, minimizing the diff.
- Alternative considered: Option A — rejected because it leaves the function fragile to future absolute-path callers.

**Decision 2: Resolve the directory once and thread it through.**
- Rationale: The three path-construction sites must agree. Resolving the directory once at the top of `expireEphemeralMemories` and passing the resolved directory to `readEphemeralFile` (via a new parameter) and to `unlink` guarantees consistency. Without this, the read path could diverge from the scan path.
- Implementation: Add a small helper that returns `contextDir` when `path.isAbsolute(contextDir)` is true, otherwise `join(cwdParam, contextDir)`. Use `node:path`'s `isAbsolute` and `join`.

**Decision 3: Keep `readEphemeralFile`'s signature backward-compatible.**
- Rationale: `readEphemeralFile(contextDir, filename, cwdParam = cwd)` is a separate exported function. Rather than change its semantics, pass the already-resolved directory as `contextDir` and set `cwdParam` to `""` (empty string) so `join("", resolvedDir, filename)` yields the resolved path. This keeps the function usable standalone while ensuring the resolved directory is honored.
- Alternative considered: adding a `resolvedDir` parameter — rejected as it complicates the signature.

## Risks / Trade-offs

- **[Risk] `join("", absolutePath, file)` behavior** → Mitigation: `node:path.join("", "/abs/path", "file")` returns `/abs/path/file` (empty segments are ignored). Verified against Node's path semantics; the resolved directory is passed as `contextDir` with `cwdParam` set to `""`.
- **[Risk] Path traversal / deletion outside context dir** → Mitigation: The guard only decides whether to prepend `cwdParam`; it never allows escaping the intended directory. The resolved directory is still the context directory supplied by the caller.
- **[Risk] Regression in existing relative-path tests** → Mitigation: Existing tests pass relative `TEST_DIR`; the guard leaves relative paths unchanged (`join(cwdParam, relativeDir)`), so existing behavior is preserved.

## Migration Plan

No migration required. This is a bug fix with no data or config changes. Rollback is a revert of the single source file change.

## Open Questions

None.
