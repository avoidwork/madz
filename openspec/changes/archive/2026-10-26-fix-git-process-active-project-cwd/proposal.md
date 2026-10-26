## Why

The `git` tool and the `process` tool run from `/app` (config.cwd / process.cwd) instead of the active project cwd. When a project is selected from `/projects`, the `file` tool correctly resolves against the active project cwd via `getProjectCwd()` from `src/workspace/project.js`, but `git` and `process` do not. This causes `git status` etc. to fail with "fatal: not a git repository" when a project is selected.

## What Changes

- `src/tools/git/index.js`: import `getProjectCwd` from `../../workspace/project.js` and `config` from `../../config/loader.js`; change `const cwd = options.cwd;` to `const cwd = options.cwd || getProjectCwd() || config.cwd || process.cwd();`.
- `src/tools/process/index.js`: import `getProjectCwd` and `config`; replace both `cwd: process.cwd()` occurrences (foreground and background spawn) with `cwd: getProjectCwd() || config.cwd || process.cwd()`.
- Add regression tests in `tests/unit/tools/git.test.js` and `tests/unit/tools/process.test.js` asserting cwd resolution against the active project.

## Capabilities

### New Capabilities
<!\-\- None \-\->

### Modified Capabilities
- `git-tool`: The git tool SHALL resolve its working directory from the active project cwd (via `getProjectCwd()`) when no explicit `options.cwd` is provided, falling back to `config.cwd` then `process.cwd()`.
- `unified-process-tool`: The process tool SHALL resolve its working directory from the active project cwd (via `getProjectCwd()`) when spawning commands, falling back to `config.cwd` then `process.cwd()`.

## Impact

- Affected code: `src/tools/git/index.js`, `src/tools/process/index.js`, `tests/unit/tools/git.test.js`, `tests/unit/tools/process.test.js`.
- No API or dependency changes. No breaking changes.
- The `path` parameter of the `git` tool remains a pathspec and is unchanged.

## Non-goals

- No changes to git action semantics, argument parsing, or the `path` parameter behavior.
- No changes to process action semantics, command escaping, or process tracking.
- No changes to the `file` tool or `src/workspace/project.js`.
