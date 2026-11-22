# Design

## Context

See proposal.md - Why. The git tool's `gitImpl` resolves its cwd as `options.cwd || getProjectCwd() || config.cwd || process.cwd()`, but the LangChain `tool()` wrapper passes `RunnableConfig` as options, which never contains `cwd`. Production calls always resolve via `getProjectCwd()`. The `worktree` handler's `add`/`remove` cases are the natural hook points for scoping the working directory.

## Goals / Non-Goals

**Goals:**
- Provide a worktree-scoped cwd store separate from the active project cwd.
- Set the git tool's working directory to a worktree on successful `worktree add`.
- Restore the working directory to the active project on `worktree remove`, including the failure path.
- Preserve the existing `options.cwd` direct-call override as highest priority.

**Non-Goals:**
- No change to the process tool or the shell-out workaround in the skills.
- No support for multiple concurrent worktrees as the scoped cwd target.

## Decisions

**Decision: Add a module-level worktree cwd store in `src/workspace/project.js`.**
Add `getWorktreeCwd()` / `setWorktreeCwd()` accessors alongside the existing `getProjectCwd()` / `setProjectCwd()`. This keeps all cwd state in one module and reuses the established accessor pattern. Alternative considered: extending `setProjectCwd` semantics to track a worktree cwd — rejected because it conflates the active project with a transient worktree scope and would require the TUI to distinguish them.

**Decision: Set the scoped cwd on successful `worktree add` using the resolved path.**
In the `add` case, after a successful `git worktree add`, resolve the created worktree path via `path.resolve(cwd, input.path)` (consistent with the existing nested-worktree rejection logic) and call `setWorktreeCwd()`. The `add` case already computes `resolvedPath` for the nested-worktree check, so reuse it.

**Decision: Restore the scoped cwd on `worktree remove`, including the failure path.**
In the `remove` case, call `setWorktreeCwd("")` on both the success path and the "contains modified or untracked files" failure path, so the agent is never left scoped to a stale worktree. Alternative considered: only restoring on success — rejected because a failed removal would leave the agent scoped to a worktree that may no longer exist.

**Decision: Update `gitImpl` cwd resolution to prefer the worktree-scoped cwd.**
Change the resolution to `options.cwd || getWorktreeCwd() || getProjectCwd() || config.cwd || process.cwd()`. The `options.cwd` direct-call override remains highest priority, preserving documented semantics.

## Risks / Trade-offs

- [Single worktree store] → The git tool operates on one worktree at a time in practice; removing a non-current worktree clears the store, which is the safe default.
- [Path traversal] → The `add` case already rejects paths inside the repo; the resolved path is used for the store, and the existing validation prevents traversal outside the project.
- [Stale scope on failure] → Restoring on the failure path ensures the agent is never left scoped to a stale worktree.
