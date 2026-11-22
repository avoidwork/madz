# Spec Delta

## MODIFIED Requirements

### Requirement: Working directory resolution from active project cwd

The system SHALL resolve the git tool's working directory from the active project cwd via `getProjectCwd()` from `src/workspace/project.js` when no explicit `options.cwd` is provided. The resolution order SHALL be `options.cwd || getWorktreeCwd() || getProjectCwd() || config.cwd || process.cwd()`. The `path` parameter SHALL remain a pathspec and SHALL NOT change the run directory. The `options.cwd` override is a direct-call-only mechanism: the LangChain `tool()` wrapper passes `RunnableConfig` as `options`, which never contains `cwd`, so production calls always resolve via `getWorktreeCwd() || getProjectCwd() || config.cwd || process.cwd()`. When the git tool creates a worktree via `worktree add`, it SHALL set the worktree-scoped cwd to the resolved worktree path so subsequent git operations are scoped to that worktree. When the git tool removes a worktree via `worktree remove`, it SHALL restore the worktree-scoped cwd to the active project, including when the removal fails.

#### Scenario: git status succeeds against the selected project
- **WHEN** the active project cwd is set to a git repository via `setProjectCwd()` and the `git` tool is called with `action: "status"` and no `path`
- **THEN** the system runs git in the active project cwd and returns `{ ok: true, branch, changes, ahead, behind }`

#### Scenario: Explicit options.cwd overrides the project cwd
- **WHEN** the `git` tool is called with `action: "status"` and an explicit `options.cwd` pointing to a different directory
- **THEN** the system runs git in the explicit `options.cwd` directory

#### Scenario: Falls back to config.cwd when no project is active
- **WHEN** no project is active (`getProjectCwd()` returns `""`) and the `git` tool is called with `action: "status"`
- **THEN** the system runs git in `config.cwd` (or `process.cwd()` if `config.cwd` is unset)

#### Scenario: Worktree add scopes the working directory
- **WHEN** the git tool successfully creates a worktree via `worktree add`
- **THEN** the git tool's working directory is set to the resolved worktree path

#### Scenario: Worktree remove restores the working directory
- **WHEN** the git tool successfully removes a worktree via `worktree remove`
- **THEN** the git tool's working directory is restored to the active project

#### Scenario: Worktree remove failure restores the working directory
- **WHEN** the git tool attempts to remove a worktree via `worktree remove` and the removal fails (e.g., the worktree contains modified or untracked files)
- **THEN** the git tool's working directory is restored to the active project so the agent is not left scoped to a stale worktree

#### Scenario: No worktree active uses the active project cwd
- **WHEN** no worktree-scoped cwd is set and no explicit `options.cwd` is provided
- **THEN** the git tool resolves its working directory via `getProjectCwd() || config.cwd || process.cwd()`
