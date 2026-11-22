# Tasks

## 1. Worktree-scoped cwd store

- [x] 1.1 Add `getWorktreeCwd()` / `setWorktreeCwd()` accessors to `src/workspace/project.js` and verify the module exports them and the existing `getProjectCwd()`/`setProjectCwd()` still work
- [x] 1.2 Add unit tests for the new accessors in `tests/unit/workspace/project.test.js` (or the existing project test file) and verify they pass

## 2. Git tool worktree cwd scoping

- [x] 2.1 In `src/tools/git/index.js`, set the worktree-scoped cwd to the resolved worktree path on successful `worktree add` and verify the git tool's cwd resolution reflects it
- [x] 2.2 In `src/tools/git/index.js`, restore the worktree-scoped cwd to the active project on successful `worktree remove` and verify the git tool's cwd resolution reflects it
- [x] 2.3 In `src/tools/git/index.js`, restore the worktree-scoped cwd on the `worktree remove` failure path (modified/untracked files) and verify the git tool is not left scoped to a stale worktree
- [x] 2.4 Update the `gitImpl` cwd resolution to `options.cwd || getWorktreeCwd() || getProjectCwd() || config.cwd || process.cwd()` and verify the existing cwd resolution tests still pass

## 3. Tests

- [x] 3.1 Add tests to `tests/unit/tools/git-actions.test.js` covering worktree add setting the scoped cwd, worktree remove restoring it, and restore on failed removal, and verify they pass
- [x] 3.2 Run `npm run test`, `npm run lint`, and `npm run coverage` and verify all pass with no regressions

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
