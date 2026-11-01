# Design

## Context

`scanAgents` (`src/tools/scanAgents/index.js`) captures the root cwd once at
module load: `const cwd = loadConfig().cwd;`, then resolves an omitted `path` as
`input.path || cwd`. Because the value is frozen before any project context is
set, the tool never consults the active project. The sibling tools `file`
(`src/tools/file/index.js`) and `discovery` (`src/tools/discovery/index.js`)
already solve this with a `resolveBaseDir()` helper returning
`getProjectCwd() || config.cwd || process.cwd()`, evaluated at call time. See
proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Resolve an omitted `path` against the live active project cwd at call time.
- Preserve the `config.cwd` and `process.cwd()` fallbacks when no project is active.
- Keep the change confined to `scanAgents` and its test.

**Non-Goals:**
- No change to explicit-`path` handling, `validatePath`/sandbox allowlist, or
  other tools.
- No new dependency.

## Decisions

- **Reuse the `getProjectCwd()` API, not a new store.** `src/workspace/project.js`
  already exposes `getProjectCwd()`/`setProjectCwd()`; the TUI writes to it on
  project selection. Reusing it keeps a single source of truth for the active
  project.
- **Inline fallback vs. `resolveBaseDir()` helper.** Two options: (a) inline
  `input.path || getProjectCwd() || config.cwd || process.cwd()` inside
  `scanAgentsImpl`, or (b) add a local `resolveBaseDir()` mirroring the siblings.
  Chosen: **inline fallback** — `scanAgents` has a single resolution site and no
  relative-path resolution (unlike `file`/`discovery`), so a helper adds no reuse
  value and would be a YAGNI abstraction. The inline chain is identical in
  behavior to the siblings' `resolveBaseDir()`.
- **Keep `config = loadConfig()` at module scope.** The `config.cwd` fallback
  still needs `config`; only the frozen `cwd` capture is removed.

## Risks / Trade-offs

- [Path traversal via the new resolution chain] → The resolved path still flows
  through `validatePath(targetPath, options.allowedPaths)`, so the sandbox
  allowlist and traversal protection are unchanged.
- [Behavior drift when no project is active] → The fallback chain degrades to
  `config.cwd || process.cwd()`, matching prior behavior; covered by a scenario.
- [Test coupling to module-load cwd] → The existing "uses process.cwd()" test is
  replaced with a `setProjectCwd()`-driven regression test, removing the coupling.

## Migration Plan

Single commit on the feature branch. No data migration. Rollback is a revert of
the one-file source change plus its test.
