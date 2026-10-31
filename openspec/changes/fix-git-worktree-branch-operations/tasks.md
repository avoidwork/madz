# Tasks

## 1. Implement worktree add existing-branch support

- [ ] 1.1 Add an `existing` boolean to the Zod schema for the `git` tool
- [ ] 1.2 In the `worktree add` case, emit `git worktree add <path> <branch>` when `existing` is true, preserving the `-b <branch>` and `--detach` paths
- [ ] 1.3 Validate `worktree add` paths to reject paths nested inside the repo working tree

## 2. Implement branch delete worktree hint

- [ ] 2.1 In the `branch` delete case, detect the "cannot delete branch ... used by worktree" stderr and return `{ ok: false, error, hint }` identifying the worktree path

## 3. Implement standalone branch-create action

- [ ] 3.1 Add a `branch` create path that emits `git branch <name> [<start-ref>]` when `create` is true, without switching HEAD
- [ ] 3.2 Allow `create` on the `branch` action in the Zod schema

## 4. Implement worktree remove dirty-worktree hint

- [ ] 4.1 In the `worktree remove` case, detect the "contains modified or untracked files" stderr and return `{ ok: false, error, hint }` indicating `--force` is required

## 5. Clarify options.cwd dead code

- [ ] 5.1 Update the JSDoc and cwd resolution comment to reflect that `options.cwd` is a direct-call-only override, not a production path

## 6. Add tests

- [ ] 6.1 Add a test for existing-branch worktree add
- [ ] 6.2 Add a test for branch-delete-with-worktree returning a hint
- [ ] 6.3 Add a test for the new branch-create action
- [ ] 6.4 Verify `npm run test`, `npm run lint`, and `npm run coverage` pass
