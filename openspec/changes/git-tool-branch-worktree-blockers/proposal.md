# Proposal

## Why

The `git` tool (`src/tools/git/index.js`) has blockers around branch and worktree operations. It cannot link a worktree to an existing branch, cannot delete a branch that is checked out in a worktree, has no standalone branch-create action, and does not surface dirty-worktree removal hints. These gaps force callers to shell out through the process tool, bypassing the git tool's guardrails and structured output.

## What Changes

- Add an `existing` flag to the `worktree add` subcommand so a worktree can be linked to an existing branch (`git worktree add <path> <branch>`) instead of only creating a new branch (`-b`) or detaching HEAD.
- Detect the `cannot delete branch ... used by worktree` stderr in the `branch` delete path and return a structured hint identifying the worktree path as the cause.
- Add a standalone branch-create path (`git branch <name> <start-ref>`) via a `create` flag on the `branch` action, complementing `checkout -b` which cannot take a start ref.
- Detect the dirty-worktree stderr in `worktree remove` and return a structured hint that `--force` is required.
- Extend unit tests in `tests/unit/tools/git.test.js` for the new behaviors.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `git-tool`: Add requirements for existing-branch worktree attachment, structured branch-delete-with-worktree handling, standalone branch creation, and dirty-worktree removal hints.

## Impact

- `src/tools/git/index.js` — the git tool implementation (worktree add, branch delete, branch create, worktree remove).
- `tests/unit/tools/git.test.js` — unit tests.
- No breaking changes to existing actions; all new behavior is additive.

## Non-goals

- Auto-removing a worktree when a branch delete is blocked. The tool returns a structured hint; removal is an explicit caller decision.
- Auto-detecting branch existence in `worktree add`. The `existing` flag is explicit and predictable.
- Any change to the `checkout` action's existing `-b` behavior.
