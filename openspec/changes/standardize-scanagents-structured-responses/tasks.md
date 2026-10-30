# Tasks

## 1. Implementation

- [x] 1.1 Modify `scanAgentsImpl` in `src/tools/scanAgents/index.js` to return `{ ok: false, error: resolved.error }` on path-validation failure and `{ ok: true, agents: await loadAgents(...) }` on success. Verify by running `node -e "import('./src/tools/scanAgents/index.js').then(m => m.scanAgentsImpl({path:'/nonexistent'}, {allowedPaths:['/tmp']}))"` and confirming the result is a structured object.
- [x] 1.2 Update the JSDoc `@returns` annotation in `src/tools/scanAgents/index.js` from `Promise<string>` to `Promise<{ ok: boolean, agents?: string, error?: string }>`. Verify by reading the file and confirming the annotation reflects the new shape.

## 2. Tests

- [x] 2.1 Update `tests/unit/tools_scanAgents.test.js` so the success case asserts `result.ok === true` and `result.agents` contains the AGENTS.md content. Verify by running `node \-\-test tests/unit/tools_scanAgents.test.js`.
- [x] 2.2 Update `tests/unit/tools_scanAgents.test.js` so the "no AGENTS.md found" and "target directory does not exist" cases assert `result.ok === true` and `result.agents === ""`. Verify by running `node \-\-test tests/unit/tools_scanAgents.test.js`.
- [x] 2.3 Update `tests/unit/tools_scanAgents.test.js` so the path-traversal and file-size-limit cases assert `result.ok === false` and `result.error` is a non-empty string. Verify by running `node \-\-test tests/unit/tools_scanAgents.test.js`.

## 3. Verification

- [x] 3.1 Run `npm run test` and confirm all tests pass.
- [x] 3.2 Run `npm run lint` and confirm no lint errors.
- [x] 3.3 Run `npm run coverage` and confirm coverage is maintained.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
