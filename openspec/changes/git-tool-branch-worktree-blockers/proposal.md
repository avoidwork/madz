# Proposal

## Why

The git tool (`src/tools/git/index.js`) has blockers around branch and worktree operations that prevent the agent from completing common git workflows. The tool cannot link a worktree to an existing branch, cannot delete a branch checked out in a worktree, and has no standalone branch-create action. These gaps force the agent to shell out through the process tool, bypassing the git tool's guardrails.

## What Changes

- Add an `existing` flag to `worktree add` so a worktree can attach to a branch that already exists (emits `git worktree add <path> <branch>`).
- Detect the "used by worktree" stderr in `branch -d`/`-D` and return a structured hint identifying the worktree path.
- Add a `create` path to the `branch` action so a branch can be created without checking it out, optionally from a start ref.
- Detect the "contains modified or untracked files" stderr in `worktree remove` and return a structured hint that `--force` is required.
- Extend the Zod schema with the new `existing` and `create` flags.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `git-tool`: Add requirements for existing-branch worktree attachment, structured branch-delete-with-worktree handling, standalone branch creation, and dirty-worktree removal hints.

## Impact

- `src/tools/git/index.js` — the git tool implementation and Zod schema.
- `tests/unit/tools/git.test.js` — extend with cases for the new behaviors.
- No breaking changes. Existing actions retain their current behavior.

## Non-goals

- Not changing the `options.cwd` resolution gap (framework-level concern, tracked separately).
- Not adding path validation for `worktree add` (separate concern).
- Not changing the `checkout -b` action.
