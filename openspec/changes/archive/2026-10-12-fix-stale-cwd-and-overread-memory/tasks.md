# Tasks: Fix stale module-level cwd capture and over-reading in memory module

## 1. Lazy cwd resolution in memory module

- [x] 1.1 Update `src/memory/context.js` — remove `const cwd = loadConfig().cwd;`, use `cwdParam = loadConfig().cwd` default on `loadContext` and `loadAndFormatProfile`
- [x] 1.2 Update `src/memory/expireEphemeralMemories.js` — remove `const cwd = loadConfig().cwd;`, use `cwdParam = loadConfig().cwd` default on `readEphemeralFile` and `expireEphemeralMemories`
- [x] 1.3 Update `src/memory/prompts.js` — remove `const cwd = loadConfig().cwd;`, use `baseDir = loadConfig().cwd` default on `loadSystemPrompt`
- [x] 1.4 Update `src/memory/retention.js` — remove `const cwd = loadConfig().cwd;`, use `cwdParam = loadConfig().cwd` default on `cleanRetainedMemory` and `enforceMaxEntries`
- [x] 1.5 Update `src/memory/screenshots.js` — remove `const cwd = loadConfig().cwd;`, use `cwdParam = loadConfig().cwd` default on `ensureScreenshotsDir`
- [x] 1.6 Update `src/memory/tools.js` — remove `const cwd = loadConfig().cwd;`, use `cwdParam = loadConfig().cwd` default on `ensureToolsDir`
- [x] 1.7 Update `src/memory/profile.js` — remove `const config = loadConfig();` and module-level `PROFILE_DIR`/`PROFILE_PATH`, add lazy `getProfilePath()` helper, use as default on `loadProfile`, `saveProfile`, `hasProfile`

## 2. Avoid over-reading in context.js

- [x] 2.1 Update `loadContext` in `src/memory/context.js` — replace "read all → sort → slice" with "stat → sort by mtime → slice → read only selected" for persistent files
- [x] 2.2 Apply the same stat-based selection to ephemeral files (slice by `ephemeralLimit`)
- [x] 2.3 Handle `stat()` failures gracefully (skip files removed between readdir and stat)

## 3. Update tests

- [x] 3.1 Update `tests/unit/context.test.js` — change ordering assertions to mtime-based ordering (use `fs.utimesSync` to set explicit mtimes)
- [x] 3.2 Verify `tests/unit/memory_expireEphemeral.test.js`, `tests/unit/memory_profile.test.js`, `tests/unit/prompts.test.js` still pass
- [x] 3.3 Run `npm run test` and `npm run lint` — all pass
