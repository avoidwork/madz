# Tasks

## 1. Resolve omitted path against active project cwd

- [x] 1.1 In `src/tools/scanAgents/index.js`, add `import { getProjectCwd } from
  "../../workspace/project.js";` and verify the import resolves (no lint error).
- [x] 1.2 Remove the module-load frozen capture `const cwd = loadConfig().cwd;`
  while keeping `const config = loadConfig();` for the `config.cwd` fallback;
  verify `npm run lint` passes.
- [x] 1.3 In `scanAgentsImpl`, change the omitted-path resolution from
  `input.path || cwd` to `input.path || getProjectCwd() || config.cwd ||
  process.cwd()`; verify `npm run lint` passes.

## 2. Regression test

- [x] 2.1 In `tests/unit/tools_scanAgents.test.js`, replace the "uses
  process.cwd() when no path is provided" test with one that calls
  `setProjectCwd(<projectDir>)` and asserts an omitted `path` resolves to the
  project directory (reads that project's `AGENTS.md`); verify the new test
  passes via `npm run test`.
- [x] 2.2 Run `npm run test` and `npm run coverage` and verify the full suite
  passes with no regressions.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
