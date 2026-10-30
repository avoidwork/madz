# Design

## Context

See proposal.md — Why. The current ephemeral-loading path in `src/memory/context.js` reads and parses every `ephemeral-*.md` file via `Promise.all` before slicing to `ephemeralLimit`. The established `find | sort` pattern in `src/tools/reflection/index.js` (lines 115-142) lists files by mtime and reads only what is needed. This design applies that pattern to the ephemeral path.

## Goals / Non-Goals

**Goals:**
- Read only the newest `ephemeralLimit` ephemeral files, not all of them.
- Order ephemeral files newest-first by mtime.
- Exclude expired ephemeral files (those whose `ephemeral_expiresAt` is in the past).
- Preserve the existing `[Ephemeral: <title>]\n<body>` output format and the position of ephemeral blocks after persistent context.

**Non-Goals:**
- No change to persistent context loading.
- No change to `reflectionSessions`, `expireEphemeralMemories`, or the `sampling` tool.
- No config schema changes (`ephemeralLimit` stays as-is).
- No change to the `find`-based pattern used by `reflectionSessions`.

## Decisions

**Decision 1: Use `execFile("find", [...])` to list ephemeral files by mtime.**
Mirrors `reflectionSessions`. The command is `find <contextDir> -maxdepth 1 -type f -name 'ephemeral-*.md' -printf '%T@ %p\n'`. Arguments are passed as an array to `execFile` (no shell interpolation), and `-maxdepth 1` scopes the search to the context directory. Alternative considered: `readdir` + `stat` in JS — rejected because it requires reading the whole directory and statting every file, which is the same O(n) cost we are trying to avoid.

**Decision 2: Sort `find` output by mtime descending (newest first).**
Parse each line as `<mtime> <path>` (split on first space), then sort by `parseFloat(mtime)` descending. This matches `reflectionSessions`.

**Decision 3: Filter to the time range using `isExpired` from `expireEphemeralMemories.js`.**
Reuse the existing helper rather than duplicating expiry logic. A file is excluded if its `ephemeral_expiresAt` is in the past. Files without `ephemeral_expiresAt` are treated as not expired (consistent with `isExpired`). This requires reading each candidate file's frontmatter to check expiry — but only for the files that survive the mtime sort, and we stop once we have `ephemeralLimit` non-expired files.

**Decision 4: Read only the newest `ephemeralLimit` non-expired files.**
Iterate the mtime-sorted list, read+parse each file, check expiry, and collect until `ephemeralLimit` non-expired entries are gathered. This bounds reads to `ephemeralLimit` in the common case (plus any expired files encountered before reaching the limit). Alternative considered: read all, then filter — rejected because it defeats the purpose.

## Risks / Trade-offs

- **[Risk] `find` binary may not be available on all platforms (e.g., Windows).** → Mitigation: `reflectionSessions` already depends on `find`, so this is consistent with the codebase's existing assumptions. The `execFile` call is wrapped in a try/catch that returns an empty ephemeral block on failure.
- **[Risk] `find` output parsing must handle the `<mtime> <path>` format robustly.** → Mitigation: split on the first space only, matching `reflectionSessions`; skip malformed lines.
- **[Risk] Expired files encountered before reaching the limit add extra reads.** → Mitigation: this is bounded by the number of expired files at the top of the mtime order, which is typically small; the GC (`expireEphemeralMemories`) removes expired files on session init, so the count is usually near zero.
- **[Trade-off] Reading frontmatter to check expiry adds a read per candidate.** → Acceptable: we only read candidates in mtime order and stop at the limit, so total reads scale with `ephemeralLimit` plus a small number of expired files, not the total file count.

## Migration Plan

No data migration. The change is internal to `loadContext`; the output format and behavior for non-expired files are unchanged. Rollback is a revert of the single-file change.

## Open Questions

None.
