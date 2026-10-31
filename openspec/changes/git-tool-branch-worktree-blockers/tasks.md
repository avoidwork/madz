# Tasks

## 1. Worktree add existing-branch support

- [ ] 1.1 Add an `existing` boolean flag to the `worktree add` subcommand in `src/tools/git/index.js` that emits `git worktree add <path> <branch>` when set with a `branch`, and verify the existing `-b` and `--detach` paths are unchanged
- [ ] 1.2 Add a unit test in `tests/unit/tools/git.test.js` for existing-branch worktree add and verify it passes

## 2. Branch delete worktree hint

- [ ] 2.1 Detect the `cannot delete branch ... used by worktree` stderr pattern in the `branch` delete path in `src/tools/git/index.js` and return `{ ok: false, error, worktree }`, and verify normal branch deletion still returns `{ ok: true, deleted: true }`
- [ ] 2.2 Add a unit test in `tests/unit/tools/git.test.js` for branch-delete-with-worktree structured hint and verify it passes

## 3. Standalone branch-create action

- [ ] 3.1 Add a `create` flag to the `branch` action in `src/tools/git/index.js` that emits `git branch <name> <start-ref>` when set, and verify the existing `branch` list and `branch -d`/`-D` paths are unchanged
- [ ] 3.2 Add a unit test in `tests/unit/tools/git.test.js` for the new branch-create action and verify it passes

## 4. Dirty-worktree removal hint

- [ ] 4.1 Detect the dirty-worktree stderr pattern in `worktree remove` in `src/tools/git/index.js` and return a structured hint that `--force` is required, and verify clean worktree removal still returns `{ ok: true, removed: true }`
- [ ] 4.2 Add a unit test in `tests/unit/tools/git.test.js` for the dirty-worktree removal hint and verify it passes

## 5. Verification

- [ ] 5.1 Run `npm run test` and verify all tests pass
- [ ] 5.2 Run `npm run lint` and verify lint passes
- [ ] 5.3 Run `npm run coverage` and verify coverage is maintained

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
