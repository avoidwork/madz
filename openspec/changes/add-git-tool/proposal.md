## Why

Every git operation in madz currently goes through the `process` tool — `spawn("sh", ["-c", command])` in `src/tools/process/index.js`. This is fragile and unsafe: there are no guardrails against destructive operations, no structured output, and no validation of the git subcommand. A first-class `git` tool with a whitelist of safe subcommands, structured output, and guardrails against destructive operations makes madz's git work more robust and consistent.

## What Changes

- Create `src/tools/git/index.js` exposing a `git` tool with an `action` key (the `todo`/`memory`/`file` pattern).
- Support actions: `status`, `diff`, `log`, `branch`, `add`, `commit`, `push`, `checkout`, `merge`, `rebase`, `stash`, `show`, `tag`.
- Input: `action` (required), plus action-specific params (`path` for status/diff, `message` for commit, `branch` for checkout/branch, `remote` for push).
- Output: structured JSON (e.g. `{ ok, branch, changes, ahead, behind }` for status; `{ ok, files, additions, deletions }` for diff) or a JSON error string.
- Guardrails: a whitelist of safe subcommands; reject destructive operations (`push --force`, `reset --hard`, `clean -fdx`, `rebase` without explicit opt-in) unless a `force: true` flag is passed and the command is explicitly allowed. Never pass arbitrary command strings to `sh -c`.
- Registration: add `git` to `TOOL_PERMISSIONS` (`["process:spawn"]`), `TOOL_CLASSIFICATIONS`, `TOOLS`, and the `buildToolConfig` switch in `src/tools/index.js`.
- Execution: use `execFile("git", [args])` (not `sh -c`) so args are passed as an array and never interpreted by a shell.

## Capabilities

### New Capabilities
- `git-tool`: A first-class `git` tool with an `action` key, structured JSON output, and guardrails against destructive operations, wrapping common git operations via `execFile("git", [args])`.

### Modified Capabilities
- None.

## Impact

- **Code**: `src/tools/git/index.js` (new), `src/tools/index.js` (registration), `tests/unit/tools/git.test.js` (new), `tests/integration/tools/git.test.js` (new).
- **No new npm packages** — the implementation uses `node:child_process` `execFile` (already used by `src/tools/process/index.js`).
- **No change** to the `process` tool.

## Non-goals

- Modifying the `process` tool.
- Adding any new npm dependency.
- Supporting arbitrary git subcommands outside the whitelist.
- Refactoring the existing skills that shell out git (`commit-push`, `git-tag`, `update-semver`, `purge-branches`).
