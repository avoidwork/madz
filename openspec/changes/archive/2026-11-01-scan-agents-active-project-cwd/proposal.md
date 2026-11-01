# Proposal

## Why

The `scanAgents` tool ignores the active project context. It captures the root
`cwd` once at module load (`const cwd = loadConfig().cwd`) and, when no `path`
argument is supplied, always falls back to that frozen root — never consulting the
active project. When a user selects a project via the /projects panel, `scanAgents`
still scans the madz root instead of the active project, returning the wrong
`AGENTS.md` (or none at all). Its sibling tools `file` and `discovery` already
resolve omitted paths against the live active project cwd; `scanAgents` is the
outlier.

## What Changes

- `scanAgents` resolves an omitted `path` against the active project cwd via
  `getProjectCwd()`, falling back to `config.cwd` and then `process.cwd()`.
- Remove the module-load frozen `const cwd = loadConfig().cwd` capture.
- Import `getProjectCwd` from `src/workspace/project.js` and evaluate the fallback
  chain at call time inside `scanAgentsImpl`.
- Update the regression test that asserted `process.cwd()` defaulting to instead
  assert active-project-cwd resolution.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `scan-agents`: the "Tool discovers AGENTS.md in specified path" requirement
  changes its default-path behavior — an omitted `path` now resolves against the
  active project cwd (`getProjectCwd() || config.cwd || process.cwd()`) rather than
  a frozen root cwd captured at module load.

## Impact

- `src/tools/scanAgents/index.js` — import `getProjectCwd`, drop the frozen cwd
  capture, resolve the omitted path against the active project at call time.
- `tests/unit/tools_scanAgents.test.js` — replace the `process.cwd()` defaulting
  test with an active-project-cwd regression test.
- No change to explicit-`path` behavior, `validatePath`/sandbox allowlist, or
  other tools. No new dependencies.

## Non-goals

- Not changing how an explicit `path` argument is handled.
- Not changing `validatePath`/sandbox allowlist or path-traversal protection.
- Not touching other tools or the `file`/`discovery` `resolveBaseDir()` helpers.
