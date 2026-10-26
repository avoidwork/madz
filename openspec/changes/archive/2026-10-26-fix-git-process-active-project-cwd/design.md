## Context

The `git` tool and the `process` tool run from `/app` (config.cwd / process.cwd) instead of the active project cwd. When a project is selected from `/projects`, the `file` tool correctly resolves against the active project cwd via `getProjectCwd()` from `src/workspace/project.js`, but `git` and `process` do not. This causes `git status` etc. to fail with "fatal: not a git repository" when a project is selected.

The root cause is that `gitImpl` reads `const cwd = options.cwd;` (line 184) and passes it to `runGit`, but `options.cwd` is never populated with the active project cwd. Similarly, `src/tools/process/index.js` spawns with `cwd: process.cwd()` at lines 84 and 124.

## Goals / Non-Goals

**Goals:**
- Make the `git` tool resolve its working directory from the active project cwd (via `getProjectCwd()`), falling back to `config.cwd` then `process.cwd()`.
- Make the `process` tool resolve its working directory from the active project cwd (via `getProjectCwd()`), falling back to `config.cwd` then `process.cwd()`.
- Preserve the explicit `options.cwd` override behavior for the `git` tool.
- Add regression tests covering cwd resolution for both tools.

**Non-Goals:**
- No changes to git action semantics, argument parsing, or the `path` parameter behavior (it remains a pathspec).
- No changes to process action semantics, command escaping, or process tracking.
- No changes to the `file` tool or `src/workspace/project.js`.

## Decisions

### Decision 1: Mirror the `file` tool's `resolveBaseDir()` pattern
The `file` tool resolves its base directory as `getProjectCwd() || config.cwd || process.cwd()`. We adopt the same `||` chain for both `git` and `process` to keep behavior consistent across tools.

- **Rationale:** `getProjectCwd()` returns `""` when no project is active, so the `||` chain naturally falls through to `config.cwd` then `process.cwd()`. This is the same source of truth the `file` tool uses.
- **Alternative considered:** Injecting the cwd at registration time in `src/tools/index.js`. Rejected because it would require threading the project cwd through the tool registry and would not reflect runtime project switches.

### Decision 2: Preserve the explicit `options.cwd` override for `git`
The `git` tool's `gitImpl(input, options)` already accepts `options.cwd`. We keep `options.cwd` as the highest-priority source: `options.cwd || getProjectCwd() || config.cwd || process.cwd()`.

- **Rationale:** Callers that explicitly pass a cwd (e.g., targeting a worktree) should retain control. This is backward-compatible.
- **Alternative considered:** Always using `getProjectCwd()`. Rejected because it would break callers that pass an explicit cwd.

### Decision 3: Import `config` via `loadConfig()` for the fallback
Both `git` and `process` need `config.cwd` as a fallback. We import `config` from `../../config/loader.js` (the same module the `file` tool uses).

- **Rationale:** `config.cwd` is the configured working directory captured at load time. Using it as a fallback matches the `file` tool's behavior exactly.

## Risks / Trade-offs

- **[Risk] `config.cwd` may be undefined in some contexts** → Mitigation: the `|| process.cwd()` fallback covers it.
- **[Risk] `getProjectCwd()` returns `""` when no project is active** → Mitigation: the `||` chain handles the empty-string falsy case, falling through to `config.cwd` then `process.cwd()`.
- **[Risk] Cross-test state leakage from `setProjectCwd`** → Mitigation: reset the project cwd (`setProjectCwd("")`) after each test.
