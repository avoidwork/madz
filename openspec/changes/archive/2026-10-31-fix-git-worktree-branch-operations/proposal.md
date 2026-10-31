# Proposal

## Why

The `git` tool (`src/tools/git/index.js`) has blockers around branch and worktree operations: it cannot link a worktree to an existing branch, cannot delete a branch that is checked out in a worktree, and has no standalone branch-create action. These gaps make common git workflows impossible through the tool and surface only raw stderr with no diagnostic.

## What Changes

- Add an `existing` flag to `worktree add` so it can emit `git worktree add <path> <existing-branch>` instead of only `-b <branch>` or `--detach`.
- Detect the "cannot delete branch ... used by worktree" stderr on `branch -d`/`-D` and return a structured `hint` identifying the worktree.
- Add a standalone `branch` create path that emits `git branch <name> <start-ref>` without switching HEAD.
- Detect the "contains modified or untracked files" stderr on `worktree remove` and return a structured `hint` that `--force` is required.
- Validate `worktree add` paths to reject paths nested inside the repo working tree.
- Clarify that `options.cwd` is a direct-call-only override, not a production path (the LangChain `tool()` wrapper passes `RunnableConfig`, which never contains `cwd`).

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `git-tool`: The `git` tool gains existing-branch worktree linking, a structured hint for branch-delete-with-worktree, a standalone branch-create action, a structured hint for dirty-worktree removal, and path validation for `worktree add`. The `options.cwd` override is clarified as direct-call-only.

## Impact

- **Modified**: `src/tools/git/index.js` — `worktree add`, `branch` delete/create, `worktree remove`, cwd resolution, and the Zod schema.
- **Modified**: `tests/unit/tools/git.test.js` — add tests for existing-branch worktree add, branch-delete-with-worktree, and the new branch-create action.
- **Dependencies**: None new. Uses existing `execFile("git", [args])` and `getProjectCwd()`.

## Non-goals

- No auto-removal of worktrees on branch delete.
- No auto-`--force` on dirty worktree removal.
- No changes to `checkout`, `merge`, `rebase`, or other git actions.
- No changes to the `git` tool's registration in `src/tools/index.js`.
