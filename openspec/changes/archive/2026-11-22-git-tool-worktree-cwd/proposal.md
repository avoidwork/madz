# Proposal

## Why

The agent currently has no first-class way to scope git operations to a worktree it just created. `gitImpl` resolves its cwd as `options.cwd || getProjectCwd() || config.cwd || process.cwd()`, but the LangChain `tool()` wrapper passes `RunnableConfig` as options, which never contains `cwd`, so production calls always resolve via `getProjectCwd()`. As a result, the create-feature/update-semver/scan-issues skills shell out through the process tool and do `cd $WORKTREE_PATH` instead of using the git tool for worktree work.

## What Changes

- Add a worktree-scoped cwd store (`getWorktreeCwd()` / `setWorktreeCwd()`) in `src/workspace/project.js`, kept separate from the active project cwd.
- On successful `worktree add`, set the git tool's working directory to the resolved worktree path.
- On successful `worktree remove`, restore the working directory to the active project.
- Restore the working directory even when `worktree remove` fails (modified/untracked files), so the agent is never left scoped to a stale worktree.
- Update the cwd resolution in `gitImpl` to prefer the worktree-scoped cwd when set, falling back to `getProjectCwd() || config.cwd || process.cwd()`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `git-tool`: The "Working directory resolution from active project cwd" requirement is updated so the git tool scopes its working directory to a worktree it created, and restores it to the active project when the worktree is removed.

## Impact

- `src/workspace/project.js` — add worktree cwd store.
- `src/tools/git/index.js` — set cwd on worktree add, restore on remove (including failure path), update `gitImpl` cwd resolution.
- `tests/unit/tools/git-actions.test.js` — add tests for worktree add setting the scoped cwd, remove restoring it, and restore on failed removal.
- No new npm dependencies. No new tool.

## Non-goals

- No change to the process tool or the shell-out workaround in the skills (those consumers are out of scope for this change).
- No support for multiple concurrent worktrees as the scoped cwd target.
