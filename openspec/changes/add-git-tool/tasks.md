## 1. Implement git tool

- [ ] 1.1 Create `src/tools/git/index.js` exposing a `git` tool and `gitImpl` function with an `action` key, following the `todo`/`memory`/`file` pattern.
- [ ] 1.2 Define a Zod schema validating `action` (enum of 13 actions) plus action-specific params (`path`, `message`, `branch`, `remote`, `ref`, `force`).
- [ ] 1.3 Implement guardrails: whitelist safe subcommands; reject destructive operations (`push --force`, `reset --hard`, `clean -fdx`, `rebase` without explicit opt-in) unless `force: true` is passed and the command is explicitly allowed.
- [ ] 1.4 Implement execution via `execFile("git", [args])` with args as an array — never `sh -c`.
- [ ] 1.5 Implement structured JSON output for all 13 actions (status, diff, log, branch, add, commit, push, checkout, merge, rebase, stash, show, tag) and structured error output.

## 2. Register git tool

- [ ] 2.1 Add `git` to `TOOL_PERMISSIONS` in `src/tools/index.js` with `["process:spawn"]`.
- [ ] 2.2 Add `git` to `TOOL_CLASSIFICATIONS` in `src/tools/index.js`.
- [ ] 2.3 Add `git` to the `TOOLS` map in `src/tools/index.js`.
- [ ] 2.4 Add `git` to the `buildToolConfig` switch in `src/tools/index.js`.

## 3. Add unit tests

- [ ] 3.1 Create `tests/unit/tools/git.test.js` with Zod schema validation tests for all actions.
- [ ] 3.2 Add guardrail rejection tests for destructive commands.
- [ ] 3.3 Add arg-array construction tests (no shell injection).

## 4. Add integration tests

- [ ] 4.1 Create `tests/integration/tools/git.test.js` running against a temp git repo: init, add, commit, status, diff, log, branch, checkout.
- [ ] 4.2 Add edge-case tests: not a git repo, dirty tree, detached HEAD, merge conflict, empty commit, branch that doesn't exist, destructive command rejected.

## 5. Verify

- [ ] 5.1 Run `npm run test` and confirm all tests pass.
- [ ] 5.2 Run `npm run lint` and confirm no lint errors.
- [ ] 5.3 Run `npm run coverage` and confirm coverage is maintained.
