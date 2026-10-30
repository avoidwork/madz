# Tasks

## 1. Implement `find | sort` ephemeral loading in `loadContext`

- [x] 1.1 Add imports for `execFile` from `node:child_process`, `promisify` from `node:util`, and `isExpired` from `./expireEphemeralMemories.js` to `src/memory/context.js`, and verify the module imports cleanly (`node -e "import('./src/memory/context.js')"`).
- [x] 1.2 Replace the ephemeral `Promise.all` block in `src/memory/context.js` with a `find`-based listing (`execFile("find", [fullPath, "-maxdepth", "1", "-type", "f", "-name", "ephemeral-*.md", "-printf", "%T@ %p\n"])`), sort by mtime descending, filter expired entries via `isExpired`, and read only the newest `ephemeralLimit` non-expired files. Verify by running `npm run test` and confirming the existing ephemeral tests pass.
- [x] 1.3 Preserve the existing `[Ephemeral: <title>]\n<body>` output format and the position of ephemeral blocks after persistent context. Verify the existing `loads ephemeral files last with correct sort order` test still passes.

## 2. Add regression tests in `tests/unit/context.test.js`

- [x] 2.1 Add a test verifying only `ephemeralLimit` ephemeral files are read when more than the limit exist. Verify the new test passes with `node --test tests/unit/context.test.js`.
- [x] 2.2 Add a test verifying ephemeral files are ordered newest-first by mtime. Verify the new test passes with `node --test tests/unit/context.test.js`.
- [x] 2.3 Add a test verifying files outside the time range (expired `ephemeral_expiresAt`) are excluded. Verify the new test passes with `node --test tests/unit/context.test.js`.

## 3. Verify quality gates

- [x] 3.1 Run `npm run test` and confirm all tests pass.
- [x] 3.2 Run `npm run lint` and confirm lint and formatting pass.
- [x] 3.3 Run `npm run coverage` and confirm the coverage report regenerates cleanly.

## Workflow follow-up

- Commit and push the OpenSpec files to the PR.
- Apply the tasks via openspec-apply-change.
- Commit and push the implementation to the PR.
- Verify the app starts (`npm start` with a timeout).
- Archive the change and push.
- Update the PR title and description.
- Post the audit results as a PR comment.
