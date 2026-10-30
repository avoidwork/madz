# Proposal

## Why

Stale ephemeral memory files in `memory/context/` are never deleted on session init. `index.js` line 164 calls `expireEphemeralMemories(config.cwd + "/" + config.memory.contextDir)`, passing an absolute path. Inside `src/memory/expireEphemeralMemories.js`, the function does `readdir(join(cwdParam, contextDir))` where `cwdParam` defaults to `cwd`. Passing an absolute `contextDir` double-joins and produces a nonexistent path, so `readdir` throws ENOENT, is caught, and returns 0. Expired ephemeral files accumulate indefinitely.

## What Changes

- Add an absolute-path guard in `src/memory/expireEphemeralMemories.js` so `join(cwd, contextDir)` only applies when `contextDir` is relative (using `path.isAbsolute()`). This makes the function tolerate both absolute and relative paths.
- Resolve the target directory once and reuse it for `readdir`, `readFile`, and `unlink` so the read path always matches the scan path.
- Add regression tests in `tests/unit/memory_expireEphemeral.test.js` covering absolute-path input, expired-file removal, and non-expired-file retention.

## Capabilities

### New Capabilities
- `ephemeral-memory`: The lifecycle of ephemeral memory entries in `memory/context/` — how they are marked, how expiry is determined, and how expired entries are removed on session init. This capability owns the requirement that expired ephemeral files are actually deleted and that the deletion path is resolved correctly regardless of whether the context directory is passed as an absolute or relative path.

### Modified Capabilities
<!-- No existing capability's requirements change at the spec level. -->

## Impact

- **Modified**: `src/memory/expireEphemeralMemories.js` — add `path.isAbsolute()` guard; resolve the directory once and reuse it for `readdir` and `unlink`/`readFile`.
- **Modified**: `tests/unit/memory_expireEphemeral.test.js` — add regression tests for absolute-path input, expired-file removal, and non-expired-file retention.
- **Dependencies**: `node:path` (already imported).
- **Tests**: `npm run test`, `npm run lint`, `npm run coverage`.

## Non-goals

- No change to the issue labels (already `approved` + `bug` + `in progress`).
- No change to the public API signature of `expireEphemeralMemories`.
- No refactoring of unrelated code.
- No change to the `index.js` caller (the function now tolerates absolute paths).
