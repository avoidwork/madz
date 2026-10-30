# Proposal

## Why

`loadContext` in `src/memory/context.js` reads and parses EVERY ephemeral memory file in `memory/context/` via `Promise.all` — mapping `readFile` + `parseFrontmatter` over all `ephemeral-*.md` files, then sorting and slicing to `ephemeralLimit` (default 5). When hundreds of ephemeral files accumulate, this is O(n) reads and parses even though only `ephemeralLimit` files are actually used. This is a performance bug that degrades session startup.

## What Changes

- Replace the ephemeral-loading block in `src/memory/context.js` with a `find | sort`-based listing that reads only the newest `ephemeralLimit` ephemeral files, mirroring the established pattern in `src/tools/reflection/index.js`.
- List ephemeral files via `execFile("find", [contextDir, "-maxdepth", "1", "-type", "f", "-name", "ephemeral-*.md", "-printf", "%T@ %p\n"])`, sort by mtime descending (newest first).
- Filter to the time range: exclude files whose `ephemeral_expiresAt` is expired, reusing `isExpired` from `src/memory/expireEphemeralMemories.js`.
- Read and parse only the newest `ephemeralLimit` files (not all of them), preserving the existing `[Ephemeral: <title>]\n<body>` output format.
- Add regression tests in `tests/unit/context.test.js` verifying: (a) only `ephemeralLimit` ephemeral files are read, (b) ephemeral files are ordered newest-first by mtime, (c) files outside the time range (expired) are excluded.

## Capabilities

### New Capabilities
<!-- None introduced. -->

### Modified Capabilities
- `ephemeral-memory`: The loading behavior of ephemeral memories changes — `loadContext` SHALL read only the newest `ephemeralLimit` ephemeral files (ordered by mtime, newest first), excluding expired entries, rather than reading and parsing every ephemeral file.

## Impact

- **Code**: `src/memory/context.js` (ephemeral-loading path only). Persistent context loading is unchanged.
- **Dependencies**: Adds `execFile` from `node:child_process`, `promisify` from `node:util`, and `isExpired` from `./expireEphemeralMemories.js`.
- **Tests**: `tests/unit/context.test.js` gains three regression tests.
- **Systems**: Session startup performance improves when many ephemeral files exist. No config schema changes (`ephemeralLimit` stays as-is).
