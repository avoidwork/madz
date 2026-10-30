# Tasks

## 1. Worktree add existing-branch support

- [ ] 1.1 Add `existing` boolean to the Zod schema in `src/tools/git/index.js` and verify `git.schema.safeParse({ action: "worktree", sub: "add", existing: true })` succeeds
- [ ] 1.2 Update the `worktree add` case to emit `git worktree add <path> <branch>` when `existing` is true, and verify the unit test covers the existing-branch path

## 2. Branch delete worktree conflict handling

- [ ] 2.1 Update the `branch` delete case to detect the `cannot delete branch ... used by worktree` stderr and return `{ ok: false, error, worktreePath }`, and verify the unit test asserts the structured hint

## 3. Standalone branch creation

- [ ] 3.1 Add `create` boolean to the Zod schema and update the `branch` case to emit `git branch <name> [<start-ref>]` when `create` is true, and verify the unit test covers branch creation with and without a start ref

## 4. Worktree remove dirty-state hint

- [ ] 4.1 Update the `worktree remove` case to detect the `contains modified or untracked files` stderr and return `{ ok: false, error, requiresForce: true }`, and verify the unit test asserts the structured hint

## 5. Tests

- [ ] 5.1 Extend `tests/unit/tools/git.test.js` with cases for existing-branch worktree add, branch-delete-with-worktree, branch-create, and dirty-worktree removal, and verify `npm run test` passes

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
