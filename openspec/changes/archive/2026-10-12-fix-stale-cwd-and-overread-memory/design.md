# Design: Fix stale module-level cwd capture and over-reading in memory module

## Context

The memory module (`src/memory/`) captures the working directory at module import time via `const cwd = loadConfig().cwd;` (and `const config = loadConfig();` in `profile.js`). `loadConfig()` is cached, but the *captured* value is a snapshot taken at import. If `config.cwd` changes at runtime (chdir, config mutation), the snapshot goes stale.

Separately, `src/memory/context.js` `loadContext()` reads the full content of every `.md` file in the context directory before sorting and slicing to `limit`. It reads more files than needed — a performance smell on directories with many context files.

## Goals / Non-Goals

**Goals:**
- Eliminate module-level `cwd`/`config` capture in `src/memory/` so the working directory is resolved lazily at call time.
- Make `loadContext()` select files by `mtime` (via `stat`) before reading content, so it reads only the files that survive the `limit`/`ephemeralLimit` slice.
- Preserve all public function signatures and output formats.

**Non-Goals:**
- Changing `loadConfig()` caching behavior.
- Refactoring memory modules outside `src/memory/`.
- Changing the `loadContext` output block structure.

## Decisions

### Decision 1: Lazy default parameters over getter functions

Default parameter evaluation in JavaScript happens at call time, which is the idiomatic lazy mechanism. Each function that previously used a module-level `cwd` now uses `cwdParam = loadConfig().cwd` as a default parameter. This requires no new helper, no getter, and no change to callers that pass an explicit path.

- **Alternative considered**: A `getCwd()` helper function. Rejected — adds indirection without benefit; default params are already lazy.
- **Alternative considered**: A getter on the config object. Rejected — `loadConfig()` returns a plain object; adding a getter is invasive.

### Decision 2: Lazy profile path via a helper

`profile.js` derives `PROFILE_DIR`/`PROFILE_PATH` from `const config = loadConfig()`. Replace with a `getProfilePath()` helper that computes `join(loadConfig().cwd, loadConfig().memory.contextDir, PROFILE_FILE)` at call time. This is used as the default for `loadProfile`, `saveProfile`, and `hasProfile`.

- **Alternative considered**: Inline `join(loadConfig().cwd, loadConfig().memory.contextDir, PROFILE_FILE)` at each call site. Rejected — DRY violation; a single helper is cleaner.

### Decision 3: Sort by mtime (stat) instead of frontmatter timestamp

`loadContext` currently reads every file, parses frontmatter, sorts by `frontmatter.timestamp`, then slices. The optimization is to `stat` each file (cheap, no content read), sort by `mtimeMs` descending, slice, then read content only for the survivors.

- **Rationale**: `stat()` is far cheaper than reading full file content. Sorting by mtime is arguably more correct for "recent context" — it reflects when a file was last written, not when its frontmatter says it was created.
- **Trade-off**: This changes the sort key from frontmatter `timestamp` to filesystem `mtime`. Tests asserting timestamp-based ordering must be updated. Files without a frontmatter timestamp now sort by mtime (previously sorted as empty string).

### Decision 4: Handle `stat()` failures gracefully

A file may be removed between `readdir` and `stat`. Wrap each `stat` in a try/catch and skip files that fail. This keeps `loadContext` resilient.

## Risks / Trade-offs

- **[Sort key change]** → Tests in `tests/unit/context.test.js` that assert timestamp-based ordering must be updated to mtime-based ordering. Mitigation: update the tests to set file mtimes explicitly (via `fs.utimesSync`) and assert on mtime order.
- **[`stat()` syscall per file]** → Adds a syscall per file, but far cheaper than reading full content. Acceptable for the context directory size.
- **[Behavioral change for files without timestamp]** → Previously sorted as empty string (stable-ish); now sorted by mtime. This is an improvement, not a regression.
- **[`profile.js` path resolution]** → `getProfilePath()` calls `loadConfig()` twice (cwd + contextDir). `loadConfig()` is cached, so this is cheap. Acceptable.

## Migration Plan

1. Apply lazy cwd resolution across `src/memory/` files.
2. Apply the `stat`-based selection in `context.js`.
3. Update `tests/unit/context.test.js` ordering assertions.
4. Run `npm run test` and `npm run lint`.

Rollback: Revert the commit; no data migration or schema change involved.
