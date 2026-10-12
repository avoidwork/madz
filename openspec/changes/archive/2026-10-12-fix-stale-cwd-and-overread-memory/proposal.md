# Proposal: Fix stale module-level cwd capture and over-reading in memory module

## Why

The memory module captures `const cwd = loadConfig().cwd` (and `const config = loadConfig()`) at module import time. If `config.cwd` changes at runtime (chdir or config mutation), these captured values go stale. Separately, `src/memory/context.js` reads the full content of every `.md` file in the context directory before sorting and slicing to `limit`, reading more files than needed.

## What Changes

- **Lazy cwd resolution**: Remove module-level `const cwd = loadConfig().cwd;` / `const config = loadConfig();` captures in `src/memory/` and resolve the working directory at call time via default parameter evaluation (`cwdParam = loadConfig().cwd`).
- **Lazy profile path**: Replace module-level `PROFILE_DIR`/`PROFILE_PATH` in `src/memory/profile.js` with a lazy helper that computes the path from `loadConfig()` at call time.
- **Avoid over-reading in `loadContext`**: Replace the "read all → sort → slice" pattern with "stat → sort by mtime → slice → read only selected". Read file content only for the files that survive the `limit`/`ephemeralLimit` slice.
- **Sort key change**: Context files are now ordered by filesystem `mtime` (newest first) instead of frontmatter `timestamp`. Output format (`[Context: <title>]` / `[Ephemeral: <title>]` blocks, profile prepended) is unchanged.

## Capabilities

### New Capabilities
<!-- None — this is a refactor of existing memory behavior. -->

### Modified Capabilities
- `memory-loading`: `loadContext` now selects files by `mtime` (stat) before reading content, rather than reading all files and sorting by frontmatter timestamp. The requirement that `loadContext` is the sole memory loading mechanism is unchanged.

## Impact

- **Files changed**: `src/memory/context.js`, `src/memory/expireEphemeralMemories.js`, `src/memory/prompts.js`, `src/memory/retention.js`, `src/memory/screenshots.js`, `src/memory/tools.js`, `src/memory/profile.js`.
- **Tests**: `tests/unit/context.test.js` ordering assertions updated to mtime-based ordering. Other memory tests (`memory_expireEphemeral.test.js`, `memory_profile.test.js`, `prompts.test.js`) verified unchanged.
- **No breaking API changes**: All function signatures and default-parameter behavior preserved. Callers passing explicit `cwdParam`/`baseDir`/`profilePath` continue to work unchanged.

## Non-goals

- Not changing the `loadConfig()` caching behavior in `src/config/loader.js`.
- Not refactoring memory modules outside `src/memory/` (e.g., `src/session/`, `src/tools/`).
- Not changing the output format of `loadContext` (block structure, profile prepending).
