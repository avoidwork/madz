## Context

madz currently performs all git operations through the `process` tool, which shells out via `spawn("sh", ["-c", command])` in `src/tools/process/index.js`. This is unsafe (no guardrails, arbitrary command strings passed to `sh -c`) and produces unstructured stdout/stderr strings that are error-prone to parse. The skills (`commit-push`, `git-tag`, `update-semver`, `purge-branches`) each re-implement git invocation with slightly different flags and error handling.

This change introduces a first-class `git` tool that wraps common git operations with a whitelist of safe subcommands, structured JSON output, and guardrails against destructive operations. It mirrors the single-tool `action`-key CRUD pattern from `src/tools/todo/index.js`.

## Goals / Non-Goals

**Goals:**
- Create `src/tools/git/index.js` exposing a `git` tool with an `action` key.
- Support 13 actions: `status`, `diff`, `log`, `branch`, `add`, `commit`, `push`, `checkout`, `merge`, `rebase`, `stash`, `show`, `tag`.
- Return structured JSON output or a JSON error string.
- Guardrails: whitelist safe subcommands; reject destructive operations unless `force: true` is passed.
- Use `execFile("git", [args])` — never `sh -c`.
- Register `git` in `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `TOOLS`, and the `buildToolConfig` switch.
- Add unit and integration tests.

**Non-Goals:**
- Modifying the `process` tool.
- Adding any new npm dependency.
- Supporting arbitrary git subcommands outside the whitelist.
- Refactoring the existing skills that shell out git.

## Decisions

### Decision: Use `execFile("git", [args])` instead of `spawn("sh", ["-c", command])`

The `process` tool uses `spawn("sh", ["-c", command])`, which passes a raw command string to a shell — a command-injection vector. The `git` tool uses `execFile("git", [args])` from `node:child_process`, passing args as an array so they are never interpreted by a shell. This is the primary security improvement.

**Alternative considered:** `spawn("git", [args])` — functionally equivalent for non-shell execution, but `execFile` is the idiomatic choice for running a single binary with an arg array and capturing output. Rejected in favor of `execFile`.

### Decision: Follow the `todo`/`memory`/`file` `action`-key pattern

The tool exports both a `git` LangChain `tool` instance and a `gitImpl` async function, mirroring the `todo`/`todoImpl` split in `src/tools/todo/index.js`. This keeps the tool testable (unit tests call `gitImpl` directly) and consistent with existing tools.

### Decision: Whitelist subcommands and require explicit `force` for destructive operations

A whitelist of 13 safe subcommands is enforced. Destructive operations (`push --force`, `reset --hard`, `clean -fdx`, `rebase` without explicit opt-in) are rejected unless a `force: true` flag is passed and the command is explicitly allowed. `reset` and `clean` are not in the action whitelist at all, so they are rejected by default.

### Decision: Structured JSON output

Each action returns structured JSON (`{ ok, branch, changes, ahead, behind }` for status; `{ ok, files, additions, deletions }` for diff) or a JSON error string (`{ ok: false, error }`). This lets the agent reason about git state without parsing raw text.

### Decision: No new npm dependency

The implementation uses `node:child_process` `execFile` (already used by `src/tools/process/index.js`). A git library like `simple-git` was considered but rejected — a thin wrapper over `execFile("git", ...)` with madz's own validation gives full control over guardrails without a new dependency.

## Risks / Trade-offs

- **Command injection** → Mitigated by using `execFile("git", [args])` with args as an array; never `sh -c`.
- **Destructive operations** → Mitigated by the whitelist and explicit `force` opt-in.
- **Git output parsing fragility** → Mitigated by parsing well-known git output formats (`--porcelain` for status, `--numstat` for diff) and returning structured JSON.
- **Edge cases (not a git repo, detached HEAD, merge conflict, empty commit)** → Mitigated by returning structured `{ ok: false, error }` responses and covering these in integration tests.

## Migration Plan

No migration required. This is a new tool plus registration. The change ships with the feature branch.

## Open Questions

None.
