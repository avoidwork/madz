# Spec Delta

## ADDED Requirements

### Requirement: Worktree add links to an existing branch
The system SHALL support linking a worktree to an existing branch via `git worktree add <path> <existing-branch>` when the `existing` flag is set, without creating a new branch.

#### Scenario: Link worktree to existing branch
- **WHEN** the `git` tool is called with `action: "worktree"`, `sub: "add"`, a `path`, a `branch`, and `existing: true`
- **THEN** the system runs `git worktree add <path> <branch>` and returns `{ ok: true, path, branch, ref }`

#### Scenario: New branch worktree add is preserved
- **WHEN** the `git` tool is called with `action: "worktree"`, `sub: "add"`, a `path`, and a `branch` without `existing`
- **THEN** the system runs `git worktree add -b <branch> <path>` and returns `{ ok: true, path, branch, ref }`

### Requirement: Branch delete returns worktree hint
The system SHALL detect the "cannot delete branch ... used by worktree" stderr on `branch -d`/`-D` and return a structured hint identifying the worktree path.

#### Scenario: Delete branch used by worktree returns hint
- **WHEN** the `git` tool is called with `action: "branch"`, `delete: true`, and a `branch` that is checked out in a worktree
- **THEN** the system returns `{ ok: false, error, hint }` where `hint` identifies the worktree path and suggests removing it first

### Requirement: Standalone branch create action
The system SHALL support creating a branch without switching HEAD via `git branch <name> [<start-ref>]` when the `create` flag is set.

#### Scenario: Create branch from a start ref
- **WHEN** the `git` tool is called with `action: "branch"`, `create: true`, a `branch`, and a `ref`
- **THEN** the system runs `git branch <branch> <ref>` and returns `{ ok: true, branch, created: true }`

#### Scenario: Create branch without a start ref
- **WHEN** the `git` tool is called with `action: "branch"`, `create: true`, and a `branch` without a `ref`
- **THEN** the system runs `git branch <branch>` and returns `{ ok: true, branch, created: true }`

### Requirement: Worktree remove returns dirty-worktree hint
The system SHALL detect the "contains modified or untracked files" stderr on `worktree remove` and return a structured hint that `--force` is required.

#### Scenario: Remove dirty worktree returns force hint
- **WHEN** the `git` tool is called with `action: "worktree"`, `sub: "remove"`, and a `path` to a dirty worktree without `force`
- **THEN** the system returns `{ ok: false, error, hint }` where `hint` indicates `--force` is required

### Requirement: Worktree add validates path
The system SHALL validate the `path` for `worktree add` and reject paths that would create a nested worktree inside the current repo working tree.

#### Scenario: Nested worktree path rejected
- **WHEN** the `git` tool is called with `action: "worktree"`, `sub: "add"`, and a `path` nested inside the repo working tree
- **THEN** the system returns `{ ok: false, error }` without running git

## MODIFIED Requirements

### Requirement: Working directory resolution from active project cwd
The system SHALL resolve the git tool's working directory from the active project cwd via `getProjectCwd()` from `src/workspace/project.js` when no explicit `options.cwd` is provided. The resolution order SHALL be `options.cwd || getProjectCwd() || config.cwd || process.cwd()`. The `path` parameter SHALL remain a pathspec and SHALL NOT change the run directory. The `options.cwd` override is a direct-call-only mechanism: the LangChain `tool()` wrapper passes `RunnableConfig` as `options`, which never contains `cwd`, so production calls always resolve via `getProjectCwd() || config.cwd || process.cwd()`.

#### Scenario: git status succeeds against the selected project
- **WHEN** the active project cwd is set to a git repository via `setProjectCwd()` and the `git` tool is called with `action: "status"` and no `path`
- **THEN** the system runs git in the active project cwd and returns `{ ok: true, branch, changes, ahead, behind }`

#### Scenario: Explicit options.cwd overrides the project cwd
- **WHEN** the `git` tool is called with `action: "status"` and an explicit `options.cwd` pointing to a different directory
- **THEN** the system runs git in the explicit `options.cwd` directory

#### Scenario: Falls back to config.cwd when no project is active
- **WHEN** no project is active (`getProjectCwd()` returns `""`) and the `git` tool is called with `action: "status"`
- **THEN** the system runs git in `config.cwd` (or `process.cwd()` if `config.cwd` is unset)
